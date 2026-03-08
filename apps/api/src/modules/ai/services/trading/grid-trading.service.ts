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
} from '../../../exchange-adapters/types/adapter.interface';
import { ExchangeBalance } from '../../../exchange-adapters/types/exchange.types';
import {
  GRID_SYSTEM_PROMPT,
  buildGridUserPrompt,
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
  enableDirectionAdjust?: boolean; // 启用方向自适应（突破时自动偏转方向，默认 false）
  directionBiasRatio?: number;     // 偏向比例（默认 0.7，即 70% 偏向 / 30% 反向）
  useMakerOnly?: boolean;      // PostOnly 限价单
  modelId?: string;            // AI 模型（默认 deepseek-chat）
  flashBreakoutPct?: number;          // 单周期价格变化超过此值立即行动（默认 5%）
  maxHourlyChangePct?: number;        // 1H 价格变化超过此值触发紧急退出（默认 10%）
  directionalCloseOnBreakout?: boolean; // 突破上界时平 short、突破下界时平 long（默认 true）
  takerFeeRate?: number;    // 交易所 Taker 手续费率（默认 DEFAULT_TAKER_FEE_RATE）
  makerFeeRate?: number;    // 交易所 Maker 手续费率（默认 DEFAULT_MAKER_FEE_RATE）
  stopLossPct?: number;          // 单格止损阈值%（默认 5）：价格偏离 ≥ 此值平掉该格
  autoAdjustThreshold?: number;  // 网格重建阈值（小数，默认 0.2 = 20%）：严重倾斜+价格偏离超此值时自动重建
  autoPauseOnTrend?: boolean;   // 检测到趋势市场自动软暂停（默认 true）
  locale?: string;              // 用户语言（用于日志翻译，如 'zh-CN', 'en'）
}

/** 网格方向 */
export type GridDirection = 'neutral' | 'long' | 'short' | 'long_bias' | 'short_bias';

/** 市场状态 */
export type RegimeLevel = 'narrow' | 'standard' | 'wide' | 'volatile';

/** 突破级别 */
export type BreakoutLevel = 'none' | 'short' | 'mid' | 'long';

/** 突破动作 */
export type BreakoutAction = 'none' | 'reduce_position' | 'pause_grid' | 'close_all' | 'adjust_direction';

/** 网格线 */
export interface GridLine {
  index: number;
  price: number;
  state: 'empty' | 'pending' | 'filled' | 'stopped' | 'short';
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
  pauseSource?: 'ai' | 'risk_control' | 'trend' | 'breakout'; // 'risk_control'=风控不可恢复; 'trend'/'breakout'=可自动恢复
  needsReconcile?: boolean; // 暂停恢复后，下次周期开始前需对齐交易所状态
  lastPrice: number;

  // 绩效追踪
  totalProfit: number;
  dailyTotalProfit: number;  // 当日已实现利润（网格挂单成交累计，UTC每日重置）
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
  lastUnrealizedPnl: number; // 最近一次从交易所持仓获取的未实现盈亏（buildGridContext 每轮更新）

  // OI 持仓量追踪（用于计算周期间变化，区分真假突破）
  lastOI: number;           // 上一周期的持仓量，0 表示未知

  // 动态杠杆（Regime 联动）
  effectiveLeverage: number;  // 当前生效杠杆 = min(leverage, regimeCap)，运行时由市场状态压低

  // 对齐 nofx checkTotalPositionLimit：每轮从交易所实时持仓计算名义价值（取代内存 filled 层累加）
  livePositionNotional: number;  // 交易所真实持仓名义价值（qty × markPrice），每轮周期开始时更新

  // 范围锁定（用户明确填写了上下界 → AI 不得通过 adjust_grid 修改）
  userLockedRange: boolean;

  // 网格范围来源（初始化时记录，供前端展示）
  rangeSource?: string;  // '用户指定' | 'ATR×5.0' | '±3.0%兜底' | 'ATR×2.0' 等

  // 逐层止损临时标记（不持久化，_前缀表示运行时临时字段）
  _pendingStopLoss?: number[];  // 需要止损的格线 index 数组

  // 实时可用保证金（每轮从交易所更新，供 placeGridLimitOrder 精确预检）
  availableBalance: number;
  // 单格止损阈值%（从 GridConfig 复制，供 buildGridContext 使用）
  stopLossPct: number;

  // === 信号驱动自动调节字段（Round 1+2，每 cycle 重算，重启后首轮为 0）===
  lastVolume24h: number;      // 最近 24h 成交量（updateBoxData 更新）
  avgDailyVolume: number;     // 近 72h 日均成交量（updateBoxData 更新）
  lastAtrHourly: number;      // ATR(14)[1h]（classifyRegime 返回后存储）
  lastAtrSpikeRatio: number;  // 当前ATR/基线ATR比率（updateBoxData 计算）
  currentOIChange: number;    // 当前周期 OI 变化%（Step 4.9 独立获取）
  lastBidAskSpread: number;   // 最近 bid/ask 价差%（Step 4.9 顺带获取）
  // === 信号驱动自动调节字段（Phase 12，每 cycle 重算，重启后首轮为 0）===
  rsiDivergenceType: 'bullish' | 'bearish' | 'none'; // RSI 背离类型（updateBoxData 计算）
  lastBidDepth: number;       // 盘口买方深度 USD（top-5 档合计，Step 4.9 获取）
  lastAskDepth: number;       // 盘口卖方深度 USD（top-5 档合计，Step 4.9 获取）
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
const DEFAULT_ATR_MULTIPLIER = 1.5; // 1.5x ATR × (gridCount/10)，使格间距恒定在 ~0.5%/格
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
// 量能骤变检测（方向自适应已移除，常量保留备查）
// const VOLUME_SPIKE_RATIO = 2.0;
// const VOLUME_SPIKE_PRICE_CONFIRM_PCT = 1.0;
// OI 真假突破确认
const BREAKOUT_OI_TRUE_THRESHOLD = 3;       // OI 变化 > +3% = 真突破，立即确认
const BREAKOUT_OI_FALSE_THRESHOLD = 1;      // OI 变化 < 1%  = 可疑
const BREAKOUT_CONFIRM_REQUIRED_OI_SUSPICIOUS = 5; // 可疑时需 5 次确认
// Bid/Ask Spread 检测
const MAX_SPREAD_PCT = 0.3;                 // 超过 0.3% 视为价差过宽，跳过下单
// Phase 12：Order Book Depth 检测
const ORDER_BOOK_DEPTH_LEVELS = 5;          // 取盘口前 5 档
const MIN_ORDER_BOOK_DEPTH_USD = 1000;      // 买卖任一方深度 < $1000 → 跳单
// Phase 12：RSI 背离检测
const RSI_DIVERGENCE_LOOKBACK = 20;         // RSI 背离检测用最近 20 根 K 线

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

  /** 市场状态英文→中文（用于日志显示） */
  private regimeLabel(regime: string): string {
    const map: Record<string, string> = {
      narrow: '窄幅震荡', standard: '标准', wide: '宽幅', volatile: '高波动',
    };
    return map[regime] ?? regime;
  }

  /** 网格方向英文→中文（用于日志显示） */
  private directionLabel(direction: string): string {
    const map: Record<string, string> = {
      neutral: '中性', long: '做多', short: '做空', long_bias: '偏多', short_bias: '偏空',
    };
    return map[direction] ?? direction;
  }

  /** AI 动作名称多语言标签（跟随用户 locale 显示）*/
  private actionLabel(action: string, locale?: string): string {
    const isCN = !locale || locale.startsWith('zh');
    if (isCN) {
      const zhMap: Record<string, string> = {
        hold:             '观望',
        pause_grid:       '暂停网格',
        resume_grid:      '恢复网格',
        place_buy_limit:  '挂买单',
        place_sell_limit: '挂卖单',
        cancel_order:     '取消订单',
        cancel_all_orders:'取消全部订单',
        adjust_grid:      '重建网格',
        close_long:       '平多仓',
        close_short:      '平空仓',
      };
      return zhMap[action] ?? action;
    }
    // 英文及其他语言：将 snake_case → Title Case（如 place_buy_limit → Place Buy Limit）
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

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
    _apiKeys: UserApiKeys = {},
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

    // Step 1: 计算边界（初始化为格数驱动兜底，后续可被 ATR 算法覆盖）
    // 目标格间距 0.5%/格：halfRange = price × 0.5% × (gridCount-1)/2
    // 10格→±2.25%，20格→±4.75%（格间距恒定，利润空间一致）
    const _defaultMult = 0.005 * (gridCount - 1) / 2;
    let upperPrice: number = currentPrice * (1 + _defaultMult);
    let lowerPrice: number = currentPrice * (1 - _defaultMult);
    let rangeSource = `±${(_defaultMult * 100).toFixed(2)}%兜底`;  // 追踪范围决策来源

    if (useATRBounds && this.indicators) {
      // ATR 自动边界，与默认公式取最小值（波动小→ATR更窄；波动大→默认公式封顶）
      const ohlcvRaw = await this.marketData.fetchOHLCV(symbol, '4h', 20);
      const highs = ohlcvRaw.map((c: any) => Number(c[2]));
      const lows = ohlcvRaw.map((c: any) => Number(c[3]));
      const closes = ohlcvRaw.map((c: any) => Number(c[4]));
      const atr = this.indicators.calculateATR(highs, lows, closes, 14);
      const capHalfRange = currentPrice * 0.03 * (gridCount / 10); // 与 reinitializeGridLevels 统一上限

      if (atr && atr > 0) {
        const mult = atrMultiplier > 0 ? atrMultiplier : DEFAULT_ATR_MULTIPLIER;
        const atrHalfRange = atr * mult * (gridCount / 10); // gridCount 因子：层数越多范围越宽，格间距恒定
        const halfRange = Math.min(atrHalfRange, capHalfRange);
        upperPrice = currentPrice + halfRange;
        lowerPrice = currentPrice - halfRange;
        rangeSource = `ATR×${mult}×(${gridCount}/10) min 默认`;
      } else {
        // ATR 计算失败，使用默认比例兜底
        upperPrice = currentPrice * (1 + _defaultMult);
        lowerPrice = currentPrice * (1 - _defaultMult);
        rangeSource = `±${(_defaultMult * 100).toFixed(1)}%兜底`;
      }
    } else if (config.upperBound && config.lowerBound
      && config.upperBound > config.lowerBound
      && config.upperBound > currentPrice
      && config.lowerBound < currentPrice
      && config.upperBound / currentPrice < 10      // 上界不超过当前价 10 倍
      && currentPrice / config.lowerBound < 10) {   // 当前价不超过下界 10 倍
      // 用户指定边界且与当前价格兼容
      upperPrice = config.upperBound;
      lowerPrice = config.lowerBound;
      rangeSource = '用户指定';
    } else {
      // 用户未填写边界，或指定边界与当前价不兼容 → ATR 自动计算，失败则默认比例兜底
      if (config.upperBound && config.lowerBound) {
        this.logger.warn(
          `[网格] 用户指定边界 [${config.lowerBound}, ${config.upperBound}] 与当前价 ${currentPrice.toFixed(6)} 不兼容，` +
          `将使用 ATR/默认比例自动计算范围（换标的后旧边界应被重置）`,
        );
      }
      // ATR 计算范围，失败则按默认公式兜底（multiplier = 0.03 × gridCount / 10）
      let atrFallbackSet = false;
      if (this.indicators) {
        try {
          const ohlcvRaw = await this.marketData.fetchOHLCV(symbol, '4h', 20);
          const highs = ohlcvRaw.map((c: any) => Number(c[2]));
          const lows = ohlcvRaw.map((c: any) => Number(c[3]));
          const closes = ohlcvRaw.map((c: any) => Number(c[4]));
          const atr = this.indicators.calculateATR(highs, lows, closes, 14);
          if (atr && atr > 0) {
            const capHalfRange = currentPrice * 0.03 * (gridCount / 10); // 与 reinitializeGridLevels 统一上限
            const atrHalf = atr * DEFAULT_ATR_MULTIPLIER * (gridCount / 10); // gridCount 因子保持格间距恒定
            const halfRange = Math.min(atrHalf, capHalfRange);
            upperPrice = currentPrice + halfRange;
            lowerPrice = currentPrice - halfRange;
            atrFallbackSet = true;
            rangeSource = `ATR×${DEFAULT_ATR_MULTIPLIER}×(${gridCount}/10) min 默认`;
            this.logger.log(
              `[网格] 自动宽度: 当前价=${currentPrice.toFixed(2)}, ATR(4H,14)=${atr.toFixed(2)}, ` +
              `ATR半幅=${atrHalf.toFixed(4)}, 默认上限=${capHalfRange.toFixed(4)}, 取小值=${halfRange.toFixed(4)}, ` +
              `范围=[${lowerPrice.toFixed(2)}, ${upperPrice.toFixed(2)}]`,
            );
          }
        } catch (_e) {
          // ATR 获取失败，使用默认公式兜底
        }
      }
      if (!atrFallbackSet) {
        upperPrice = currentPrice * (1 + _defaultMult);
        lowerPrice = currentPrice * (1 - _defaultMult);
        this.logger.log(
          `[网格] 兜底宽度 (±${(_defaultMult * 100).toFixed(1)}%): 当前价=${currentPrice.toFixed(2)}, ` +
          `范围=[${lowerPrice.toFixed(2)}, ${upperPrice.toFixed(2)}]`,
        );
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
        if (balance.totalEquity > 0) {
          initialEquity = balance.totalEquity;
        }
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
      dailyTotalProfit: 0,
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
      lastUnrealizedPnl: 0, // 首轮 buildGridContext 后从交易所持仓更新
      lastOI: 0,
      effectiveLeverage: leverage, // 初始 = 用户配置值，运行时由 regime 压低
      userLockedRange: rangeSource === '用户指定', // 用户填了具体数值 → AI 不得调整范围
      rangeSource,  // 持久化供前端展示: '用户指定' | 'ATR×5.0' | '±3.0%兜底' 等
      availableBalance: 0, // 初始为 0，首轮 buildGridContext 后从交易所更新
      stopLossPct: config.stopLossPct ?? DEFAULT_STOP_LOSS_PCT,
      // 信号驱动字段：首轮为 0，第二轮起正常计算
      lastVolume24h: 0,
      avgDailyVolume: 0,
      lastAtrHourly: 0,
      lastAtrSpikeRatio: 0,
      currentOIChange: 0,
      lastBidAskSpread: 0,
      rsiDivergenceType: 'none' as const,
      lastBidDepth: -1,  // -1 = 未取到数据（跳过检测）；0 = 取到但空盘口（触发跳单）
      lastAskDepth: -1,
      livePositionNotional: 0,  // 交易所真实持仓名义价值，每轮从 GetPositions 更新
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
          gridCount,
          lower: lowerPrice,
          upper: upperPrice,
          spacing: gridSpacing,
          currentPrice,
          rangeSource,
          direction,
          reasoning: `网格初始化完成 [${rangeSource}]` +
            `\n范围: $${lowerPrice.toFixed(2)} ~ $${upperPrice.toFixed(2)} (${rangePctTotal}%)` +
            `\n间距: $${gridSpacing.toFixed(4)}, 每格 $${(totalInvestment / gridCount).toFixed(2)}` +
            `\n当前价: $${currentPrice.toFixed(4)}`,
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
        // 兼容旧数据：信号字段（Phase 11/12 新增，旧 DB 记录无此字段）
        state.lastVolume24h ??= 0;
        state.avgDailyVolume ??= 0;
        state.lastAtrHourly ??= 0;
        state.lastAtrSpikeRatio ??= 0;
        state.currentOIChange ??= 0;
        state.lastBidAskSpread ??= 0;
        (state as any).rsiDivergenceType ??= 'none';
        state.lastBidDepth ??= -1;
        state.lastAskDepth ??= -1;
        // 从 DB 恢复，需要 reconcile
        await this.reconcileGridState(strategyId, userId, apiKeyId, state);
        // 每次重启都以当前价为中心重算 ATR 边界
        // 有持久化但重启语义一致：恢复后立即重建范围（保留 filled 持仓，重置 empty/pending）
        if (!state.userLockedRange) {
          const restartPrice = await this.getCurrentPrice(state.symbol).catch(() => state!.lastPrice);
          this.logger.log(`[网格] DB 恢复后重启：以当前价 ${restartPrice.toFixed(4)} 重算 ATR 边界`);
          await this.reinitializeGridLevels(state, restartPrice);
          await this.persistGridState(strategyId, state);
          // reinitialize 清空了 orderBook，此时 exchange 上的旧价位挂单变成孤儿
          // 补充一次孤儿清理（不需要重跑完整 reconcile，只处理 orphan）
          await this.cancelOrphanOrders(strategyId, userId, apiKeyId, state);
        }
      }
    }

    // Step 1.2: 止盈/止损后的重启恢复
    // 用户手动 startStrategy 重新激活策略时，isPaused=true + pauseSource='risk_control'
    // 直接清除暂停状态，策略正常运行；totalProfit/dailyTotalProfit 保留（止盈止损百分比由用户在配置里调高）
    if (state && state.isPaused && state.pauseSource === 'risk_control') {
      state.isPaused = false;
      state.pauseSource = undefined;
      state.pauseReason = undefined;
      state.startEquity = state.lastEquity;  // 回撤/均值基准归位
      state.peakEquity  = state.lastEquity;
      state.maxDrawdown = 0;
      state.chargedProfit = 0;
      this.logger.log(
        `[网格] ✅ 策略重启: 累计利润 ${state.totalProfit >= 0 ? '+' : ''}${state.totalProfit.toFixed(2)} USDT 保留 | ` +
        `止盈止损目标由配置决定（如需下一轮触发，请修改配置百分比）`,
      );
      await this.persistGridState(strategyId, state);
      this.gridStates.set(strategyId, state);
      // 风控重启后立即 reconcile：读取交易所现有挂单和持仓
      await this.reconcileGridState(strategyId, userId, apiKeyId, state);
    }

    // Step 1.3: AI 暂停恢复后 reconcile（每次恢复都重新从交易所读取真实状态）
    // resume_grid / breakout 自动恢复 会设置 needsReconcile=true，下次周期开始时触发
    if (state && !state.isPaused && state.needsReconcile) {
      state.needsReconcile = false;
      await this.reconcileGridState(strategyId, userId, apiKeyId, state);
    }

    // Step 1.5: 配置变更检测 — 用户修改参数后自动重建网格
    // 历史累计数据在配置变更时需保留（totalProfit 是策略创建以来的总和，不随重建清零）
    let preservedProfit: number | null = null;
    let preservedTrades: number | null = null;
    let preservedWinning: number | null = null;
    if (state && state.isInitialized && gridConfig) {
      const configChanged = this.detectGridConfigChange(state, gridConfig);
      if (configChanged) {
        this.logger.warn(
          `[网格] 检测到配置变更: ${configChanged}，清理旧网格并重新初始化`,
        );
        // 保存历史累计数据（跨配置变更不清零）
        preservedProfit = state.totalProfit;
        preservedTrades = state.totalTrades;
        preservedWinning = state.winningTrades;
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
        // 配置变更重建时，恢复历史累计利润（首次初始化时 preserved 为 null，保持 0）
        if (preservedProfit !== null) {
          state.totalProfit    = preservedProfit;
          state.totalTrades    = preservedTrades!;
          state.winningTrades  = preservedWinning!;
          this.logger.log(`[网格] 配置变更重建：保留累计利润 ${preservedProfit >= 0 ? '+' : ''}${preservedProfit.toFixed(2)} USDT`);
          await this.persistGridState(strategyId, state);
        }
        // 新建/重建后立即 reconcile：读取交易所现有挂单和持仓
        await this.reconcileGridState(strategyId, userId, apiKeyId, state);
      } else {
        this.logger.warn(`[网格] 策略 ${strategyId} 未初始化`);
        return { trades: 0, errors: 0 };
      }
    }

    // 每轮从 gridConfig 重新评估 userLockedRange（不持久化锁定标志，每次从配置读取最新值）
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
        // 对齐 nofx checkTotalPositionLimit：用交易所真实持仓名义价值，取代内存 filled 层（避免幽灵持仓虚高）
        {
          const baseSymbol = state.symbol.split('/')[0];
          state.livePositionNotional = livePositions.reduce((sum: number, pos: any) => {
            if ((pos as any).symbol?.includes(baseSymbol)) {
              const qty = Math.abs((pos as any).quantity ?? (pos as any).positionAmt ?? 0);
              const px = (pos as any).markPrice ?? (pos as any).entryPrice ?? currentPrice ?? 0;
              return sum + qty * px;
            }
            return sum;
          }, 0);
        }
        this.logger.debug(`[网格] Step3: livePositions.len=${livePositions.length}, livePositionNotional=${state.livePositionNotional.toFixed(4)}`);
        // 注意：不在此 dispose() — 保留缓存实例供 Step 8 的 buildGridContext 复用
        // 原先 dispose() 会使缓存失效，DrawdownMonitor 期间拿到同一实例后再 dispose()，
        // 导致 LLM 调用后 adapter.exchange===null，所有执行全报"适配器未初始化"
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
      // 使用北京时间（UTC+8）计算"今天"，确保日内重置在北京 0 点，而非 UTC 0 点（北京 8 点）
      const todayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (state.dailyPnlResetDate !== todayStr) {
        state.dailyPnlResetDate = todayStr;
        state.dailyPnl = 0;
        state.dailyTotalProfit = 0;
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
        // 同格反向后 state='pending'，用 positionSize>0 而非 state==='filled' 检测持仓
      if (line.positionSize <= 0 || line.positionEntry <= 0) continue;
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
    // dailyLossLimitPct <= 0 视为禁用（0 = 不限制日内亏损）
    const dailyLossLimitPct = gridConfig?.dailyLossLimitPct ?? DEFAULT_DAILY_LOSS_LIMIT_PCT;
    const dailyBase = state.dailyStartEquity > 0 ? state.dailyStartEquity : state.totalInvestment;
    if (dailyLossLimitPct > 0 && state.dailyPnl < 0 && dailyBase > 0) {
      const dailyLossPct = (Math.abs(state.dailyPnl) / dailyBase) * 100;
      if (dailyLossPct >= dailyLossLimitPct) {
        const dailyReason =
          `日内亏损保护触发\n` +
          `保护规则: 今日亏损超过 ${dailyLossLimitPct}% 时平仓退出\n` +
          `实际情况: 今日已亏损 ${dailyLossPct.toFixed(1)}%（$${Math.abs(state.dailyPnl).toFixed(2)}）`;
        // 软暂停：撤单但不平仓（避免浮亏变实亏，持仓等待价格恢复）
        await this.softPauseGrid(state, userId, apiKeyId, dailyReason);
        await this.persistGridState(strategyId, state);
        await this.prisma.aiStrategyLog.create({
          data: {
            strategyId,
            symbol: state.symbol,
            decision: {
            action: 'daily_loss_pause',
            gridSummary: 'daily_loss_pause×1',
            limitPct: dailyLossLimitPct,
            actualPct: dailyLossPct,
            pnlAmount: Math.abs(state.dailyPnl),
            reasoning: dailyReason,
          } as any,
            executed: true,
          },
        });
        return { trades: 0, errors: 0 };
      }
    }

    // Step 4.9: OI 变化 + bid/ask Spread 预获取（供 confirmBreakout OI 过滤 + placeGridLimitOrder Spread 检测）
    if (this.adapterFactory && apiKeyId) {
      try {
        const tickerAdapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
        try {
          if (typeof (tickerAdapter as any).fetchTicker === 'function') {
            const ticker = await (tickerAdapter as any).fetchTicker(state.symbol);
            const currentOI = Number(ticker?.info?.openInterest ?? ticker?.openInterest ?? 0);
            if (currentOI > 0 && state.lastOI > 0) {
              state.currentOIChange = (currentOI - state.lastOI) / state.lastOI * 100;
            } else {
              state.currentOIChange = 0;
            }
            if (currentOI > 0) state.lastOI = currentOI;
            const bid = Number(ticker?.bid ?? 0);
            const ask = Number(ticker?.ask ?? 0);
            if (bid > 0 && ask > 0) {
              state.lastBidAskSpread = (ask - bid) / bid * 100;
            }
          }
          // 盘口深度（top-5 档 USD 合计）
          if (isGridAdapter(tickerAdapter)) {
            try {
              const ob = await (tickerAdapter as GridExchangeAdapter).getOrderBook(
                state.symbol, ORDER_BOOK_DEPTH_LEVELS,
              );
              state.lastBidDepth = ob.bids.reduce((s, [p, q]) => s + p * q, 0);
              state.lastAskDepth = ob.asks.reduce((s, [p, q]) => s + p * q, 0);
            } catch { /* 深度获取失败不影响主流程 */ }
          }
        } finally {
          await tickerAdapter.dispose();
        }
      } catch { state.currentOIChange = 0; }
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
            if (action === 'adjust_direction') {
              // 方向自适应：偏转网格方向，取消挂单，AI 下个周期重新下单
              const newDir = this.determineGridDirection(level, direction as 'up' | 'down');
              const prevDir = state.currentDirection;
              state.currentDirection = newDir;
              const biasRatio = gridConfig?.directionBiasRatio ?? DIRECTION_BIAS_RATIO;
              this.applyGridDirection(state.gridLines, currentPrice, newDir, biasRatio);
              if (this.adapterFactory) {
                let adjustAdapter: ExchangeAdapter | null = null;
                try {
                  adjustAdapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
                  await adjustAdapter.cancelAllOrders(state.symbol);
                  state.orderBook = {};
                  for (const line of state.gridLines) {
                    if (line.state === 'pending') line.state = 'empty';
                  }
                } catch (e: any) {
                  this.logger.warn(`[网格] 方向调整撤单失败(继续): ${e.message}`);
                } finally {
                  if (adjustAdapter) await adjustAdapter.dispose().catch(() => {});
                }
              }
              this.logger.warn(
                `[网格] 方向调整: ${prevDir} → ${newDir} ` +
                `(突破${direction === 'up' ? '上' : '下'}界, 级别: ${level})`,
              );
            } else {
              await this.executeBreakoutAction(state, action, direction, userId, apiKeyId);
              if (state.isPaused) {
                await this.persistGridState(strategyId, state);
                return { trades: 0, errors: 0 };
              }
            }
          }
        } else {
          // 虚假突破恢复检查
          this.checkFalseBreakoutRecovery(state, currentPrice);
          // 方向恢复检查：价格回归盒内时，逐步向中性方向恢复
          if (
            gridConfig?.enableDirectionAdjust &&
            state.currentDirection !== 'neutral'
          ) {
            const recoveryDir = this.determineRecoveryDirection(state.currentDirection);
            if (recoveryDir !== state.currentDirection) {
              const prevDir = state.currentDirection;
              state.currentDirection = recoveryDir;
              const biasRatio = gridConfig?.directionBiasRatio ?? DIRECTION_BIAS_RATIO;
              this.applyGridDirection(state.gridLines, currentPrice, recoveryDir, biasRatio);
              if (this.adapterFactory) {
                let recoverAdapter: ExchangeAdapter | null = null;
                try {
                  recoverAdapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
                  await recoverAdapter.cancelAllOrders(state.symbol);
                  state.orderBook = {};
                  for (const line of state.gridLines) {
                    if (line.state === 'pending') line.state = 'empty';
                  }
                } catch (e: any) {
                  this.logger.warn(`[网格] 方向恢复撤单失败(继续): ${e.message}`);
                } finally {
                  if (recoverAdapter) await recoverAdapter.dispose().catch(() => {});
                }
              }
              this.logger.log(`[网格] 方向恢复: ${prevDir} → ${recoveryDir} (价格回归盒内)`);
            }
          }
        }
      } catch (e: any) {
        this.logger.warn(`[网格] 箱体分析失败: ${e.message}`);
      }
    }

    // Steps 5.3/5.4: 量能骤变/ATR Spike 方向信号 — 已移除
    // 后端不自动调整方向，由 AI 决策（pause_grid/continue）

    // Step 6: 市场状态分类
    if (this.indicators) {
      try {
        const { regime, atrHourly } = await this.classifyRegime(state.symbol);
        state.currentRegime = regime;
        state.lastAtrHourly = atrHourly;
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
        `(市场=${this.regimeLabel(state.currentRegime)}, 配置=${state.leverage}x, 上限=${regimeCap}x)`,
      );
      state.effectiveLeverage = newEffective;
    }

    // Step 6.6: 方向自适应 — 由 enableDirectionAdjust 控制（默认关闭）
    // 启用时：突破 → Step 5 自动偏转方向；回归 → 逐步恢复中性

    // Step 7: 暂停检查
    if (state.isPaused) {
      this.logger.warn(`[网格] ${state.symbol} 已暂停 [${state.pauseSource ?? '未知来源'}]: ${state.pauseReason || '未知原因'}`);
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
        `[网格] ▶ ${state.symbol} | 价格=${currentPrice} | 市场=${this.regimeLabel(state.currentRegime)} | ` +
        `日内=${state.dailyPnl >= 0 ? '+' : ''}${state.dailyPnl.toFixed(2)} USDT | ` +
        `策略收益=${currentProfitPct >= 0 ? '+' : ''}${currentProfitPct.toFixed(2)}% | ` +
        `挂单=${activeOrders} 累计=${state.totalProfit.toFixed(2)} USDT`,
      );
    }
    if (this.llm && this.adapterFactory) {
      let adapter: ExchangeAdapter | null = null;
      try {
        adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);

        // 每轮清理僵尸止损单（不再主动放交易所止损单，此处为防残留）
        if (isGridAdapter(adapter)) {
          try {
            await (adapter as GridExchangeAdapter).cancelStopOrders(state.symbol);
          } catch (e: any) {
            this.logger.warn(`[网格] 清理止损单失败(忽略): ${e.message}`);
          }
        }

        // 突破检测：在 syncOrderFills 之后、AI 决策之前执行
        // ≥2% 超出边界：取消所有挂单并暂停
        // ≥2%: 取消所有挂单并暂停; 1-2%: 仅记录警告
        if (state.upperPrice > 0 && state.lowerPrice > 0) {
          const breakout = this.checkBreakout(state, currentPrice);
          if (breakout.type !== 'none') {
            const paused = await this.handleBreakout(
              state, breakout as { type: 'upper' | 'lower'; pct: number }, adapter, strategyId,
            );
            if (paused) return { trades, errors };
          }
        }

        // 执行逐层止损（在 AI 决策之前，adapter 已就绪）
        if (state._pendingStopLoss?.length && isGridAdapter(adapter)) {
          for (const idx of state._pendingStopLoss) {
            const line = state.gridLines[idx];
            // 同格反向后 state='pending'，但 positionSize>0 时仍持有仓位需止损
            if (!line || line.positionSize <= 0) continue;
            try {
              // side 不翻转：'buy' = 持多头，'sell' = 持空头
              const closeSide = line.side === 'buy' ? 'long' : 'short';
              const slCloseResult = closeSide === 'long'
                ? await (adapter as GridExchangeAdapter).closeLong(state.symbol, line.positionSize)
                : await (adapter as GridExchangeAdapter).closeShort(state.symbol, line.positionSize);
              await this.settleGridFee(state, userId, slCloseResult.realizedPnl ?? 0);
              await this.syncDbPositionClose(userId, state.symbol, closeSide, line.positionSize, 'per_level_stop_loss', slCloseResult);
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
              const slLossPct = line.positionEntry > 0
                ? ((Math.abs(currentPrice - line.positionEntry) / line.positionEntry) * 100).toFixed(2)
                : '?';
              this.logger.warn(
                `[网格] 止损执行: level=${idx}, entry=$${line.positionEntry.toFixed(4)}, ` +
                `current=$${currentPrice.toFixed(4)}, loss=${slLossPct}%`,
              );
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
        // 环形平仓模式：卖单成交后卖层 positionSize=0，只有买单成交会留下 positionSize>0 的格线
        // 因此 skewSell 在正常环形平仓下始终为 0，不应因此轻易触发 severe
        // buyFilled > 0 && sellFilled == 0 && sellEmpty > 5 才算 severe
        const filledAll = state.gridLines.filter(l => l.state === 'filled' && l.positionSize > 0);
        const skewBuy = filledAll.filter(l => l.side === 'buy').length;   // 持多头（buy成交，side='buy'）
        const skewSell = filledAll.filter(l => l.side === 'sell').length; // 持空头（sell成交，side='sell'）
        const skewTotal = skewBuy + skewSell;
        let skewLevel: 'none' | 'light' | 'severe' = 'none';
        if (skewTotal >= 3) {
          const heavy = Math.max(skewBuy, skewSell);
          const light = Math.min(skewBuy, skewSell);
          // 环形平仓模式下 light(=skewSell) 永远为 0，heavy >= 3 即触发 severe（3:1 倾斜比）
          if ((light === 0 && heavy >= 3) || (light > 0 && heavy >= 3 * light)) skewLevel = 'severe';
          else if (heavy >= 2 * light) skewLevel = 'light';
        }
        (context as any).gridSkewLevel = skewLevel;
        (context as any).gridSkewBuyFilled = skewBuy;
        (context as any).gridSkewSellFilled = skewSell;
        if (skewLevel !== 'none') {
          this.logger.warn(`[网格] 全局倾斜: ${skewLevel} buy=${skewBuy} sell=${skewSell}`);
        }

        // autoAdjustGrid: 严重倾斜 + 价格偏离网格中点 > 阈值 → 代码层自动居中重排
        // 仅在价格显著偏离时才介入，否则交由 AI 补单
        if (skewLevel === 'severe' && isGridAdapter(adapter)) {
          const gridMid = (state.upperPrice + state.lowerPrice) / 2;
          const gridRange = state.upperPrice - state.lowerPrice;
          const priceDeviation = Math.abs(currentPrice - gridMid);
          const deviationPct = gridRange > 0 ? (priceDeviation / gridRange) * 100 : 0;
          const adjustThreshold = gridConfig?.autoAdjustThreshold ?? 0.2;  // 读取配置，默认 20%
          const adjustThresholdPct = Math.round(adjustThreshold * 100);
          if (priceDeviation > gridRange * adjustThreshold) {
            this.logger.warn(
              `[网格] autoAdjustGrid: 严重倾斜 buy=${skewBuy} sell=${skewSell}, ` +
              `价格偏离中点 ${deviationPct.toFixed(1)}% > ${adjustThresholdPct}%，自动取消+居中重排`,
            );
            try {
              await (adapter as GridExchangeAdapter).cancelAllOrders(state.symbol);
            } catch (e: any) {
              this.logger.warn(`[网格] autoAdjustGrid cancelAll 失败(继续): ${e.message}`);
            }
            await this.reinitializeGridLevels(state, currentPrice);
            await this.persistGridState(strategyId, state);
            return { trades: 0, errors: 0 };
          } else {
            this.logger.warn(
              `[网格] 严重倾斜(buy=${skewBuy} sell=${skewSell})但价格偏离仅 ${deviationPct.toFixed(1)}% < ${adjustThresholdPct}%，跳过自动居中，由 AI 本轮补挂空侧格线`,
            );
          }
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
        // --- 单边快速行情：≥6% + RSI 确认 → 仅告警，由 AI 决策（pause_grid/continue）---
        const rapidRise = context.priceChange1h > 6 && context.rsi14 > 70;
        const rapidFall = context.priceChange1h < -6 && context.rsi14 < 30;
        if (rapidRise || rapidFall) {
          this.logger.warn(
            `[网格] 单边快速行情(${Math.abs(context.priceChange1h).toFixed(1)}% 1H, RSI=${context.rsi14.toFixed(0)})，` +
            `交由 AI 决策（pause_grid/hold）`,
          );
          // 后端不调整方向，由 AI 在本轮 prompt 中看到市场数据后自主决策
        }

        const modelId = gridConfig?.modelId || 'deepseek-chat';

        const response = await this.llm.chat(
          modelId,
          GRID_SYSTEM_PROMPT(state.symbol, state.gridLines.length, state.totalInvestment, state.leverage, state.distribution, currentPrice),
          buildGridUserPrompt(context),
          apiKeys,
          { temperature: 0.3, maxTokens: 1500 },
        );

        // LLM 调用期间（30-40s）DrawdownMonitor 可能已 dispose 同一缓存 adapter
        // 重新检查，若已失效则重建，确保后续执行循环正常
        if (!adapter.isReady()) {
          this.logger.warn(`[网格] LLM 调用后 adapter 已失效，重新获取`);
          adapter = await this.adapterFactory!.createAdapter(userId, apiKeyId);
        }

        // 对齐 nofx: LLM 调用期间（await 释放事件循环）用户可能已停止策略
        // 执行任何决策前再次检查，防止在已停止的策略上下单
        if (state.isPaused || !this.gridStates.has(strategyId)) {
          this.logger.warn(`[网格] LLM 调用后策略已停止/暂停，跳过本轮决策执行`);
          return { trades, errors };
        }

        // 解析 AI 决策（新格式：{analysis, actions}，兼容旧格式 [...]）
        const { decisions, analysis: marketAnalysis } = this.parseGridDecisions(response.content);

        // confidence 过滤（未提供 confidence 的决策默认通过，兼容旧格式）
        const CONFIDENCE_THRESHOLD = 40;
        const filteredDecisions = decisions.filter(d => {
          if (d.action === 'hold') return true;
          if (d.confidence === undefined) return true;
          if (d.confidence >= CONFIDENCE_THRESHOLD) return true;
          this.logger.warn(
            `[网格] 低置信决策跳过: action=${this.actionLabel(d.action, gridConfig?.locale)} confidence=${d.confidence} reasoning=${d.reasoning}`,
          );
          return false;
        });

        // 执行决策（收集每条执行结果，供日志记录）
        const execResults: Array<{ action: string; success: boolean; skipped?: boolean; skipReason?: string; error?: string }> = [];
        let accountConfigError: string | null = null; // OKX 51010 等账户配置错误（需用户手动修复）
        // 若决策列表包含 pause_grid，跳过所有 place_* 操作（否则下单后立即被撤，浪费 API 调用）
        const hasPauseGrid = filteredDecisions.some(d => d.action === 'pause_grid');
        for (const d of filteredDecisions) {
          // 对齐 nofx: 每条决策执行前检查策略是否已被停止（执行过程中用户可能通过 API 停止）
          if (state.isPaused || !this.gridStates.has(strategyId)) {
            const remaining = filteredDecisions.length - filteredDecisions.indexOf(d);
            this.logger.warn(`[网格] 策略已停止/暂停，跳过剩余 ${remaining} 个决策`);
            break;
          }
          // 若本轮含 pause_grid，跳过所有 place_* 操作（避免下单后立即被 cancelAllOrders 撤掉，浪费 API 调用）
          if (hasPauseGrid && d.action.startsWith('place_')) {
            execResults.push({ action: d.action, success: true, skipped: true, skipReason: '本轮含 pause_grid，跳过下单' });
            continue;
          }
          // 账户配置错误已确认（如 OKX 51010）→ 跳过后续下单，避免刷屏重试
          if (accountConfigError) {
            execResults.push({ action: d.action, success: false, error: accountConfigError });
            errors++;
            continue;
          }
          try {
            const result = await this.executeGridDecision(state, d, adapter, userId, apiKeyId, gridConfig?.useMakerOnly ?? false, currentPrice, gridConfig?.locale);
            if (result.executed && d.action.includes('place_')) trades++;
            execResults.push({ action: d.action, success: true, skipped: !result.executed, skipReason: result.skipReason });
          } catch (e: any) {
            errors++;
            const errCategory = classifyExchangeError(e);
            const rawCode = e?.code ?? e?.id ?? '';
            this.logger.warn(`[网格] 执行决策失败: ${this.actionLabel(d.action, gridConfig?.locale)} [${errCategory}${rawCode ? '/' + rawCode : ''}] - ${e.message}`);
            const errEntry = `[${errCategory}${rawCode ? '/' + rawCode : ''}] ${e.message}`;
            execResults.push({ action: d.action, success: false, error: errEntry });
            // 账户配置错误（如 OKX 51010）是持久性错误，后续订单无需再试
            if (errCategory === '账户配置错误') {
              accountConfigError = errEntry;
              this.logger.error(`[网格] 账户配置错误（如 OKX 未开通合约交易），本轮停止下单: ${e.message}`);
            }
          }
        }

        // syncOrderFills 在 AI 执行之后（周期末）
        // 检测本轮 AI 执行后的新成交，更新格线状态供下轮决策使用
        if (isGridAdapter(adapter)) {
          const { filledLines } = await this.syncOrderFills(state, adapter as GridExchangeAdapter, userId);
          if (filledLines.length > 0) {
            trades += filledLines.length;
            this.logger.log(`[网格] 成交同步: ${filledLines.length} 笔新成交 | 累计 +${state.totalProfit.toFixed(2)} USDT`);
          }
        }

        // 层级状态摘要日志（供运营核对交易所，LOG 级别确保生产可见）
        {
          const filled = state.gridLines.filter(l => l.state === 'filled');
          const pending = state.gridLines.filter(l => l.state === 'pending');
          const empty = state.gridLines.filter(l => l.state === 'empty');
          const filledStr = filled.map(l =>
            `L${(l.index ?? 0) + 1}@${(l.positionEntry ?? l.price).toFixed(2)}×${(l.positionSize ?? 0).toFixed(3)}`
          ).join(' ');
          const pendingStr = pending.map(l => `L${(l.index ?? 0) + 1}@${l.price.toFixed(2)}`).join(' ');
          const emptyStr = empty.map(l => `L${(l.index ?? 0) + 1}`).join(',');
          this.logger.log(
            `[网格] 层级 | 持仓: ${filledStr || '无'} | 挂单: ${pendingStr || '无'} | 空格: [${emptyStr || '无'}]`,
          );
        }

        // 记录到 AiStrategyLog（含 GridState 快照和执行结果）
        // 每轮都写入，无操作轮次由前端归类为"X 次分析无操作（已隐藏）"
        {
          const hasIssues = execResults.some(r => !r.success || r.skipped);
          await this.saveGridDecisionLog(
            strategyId, state.symbol, decisions, response.cost, state, response.thinking,
            hasIssues ? execResults : undefined, marketAnalysis,
          );
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
        `市场=${this.regimeLabel(state.currentRegime)} 方向=${this.directionLabel(state.currentDirection)}`,
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

  /** 更新 Donchian 箱体数据（3 个周期）+ 量能统计 + ATR Spike 比率 */
  private async updateBoxData(state: GridState): Promise<void> {
    const ohlcvRaw = await this.marketData.fetchOHLCV(state.symbol, '1h', 504);
    const highs = ohlcvRaw.map((c: any) => Number(c[2]));
    const lows = ohlcvRaw.map((c: any) => Number(c[3]));
    const closes = ohlcvRaw.map((c: any) => Number(c[4]));

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

    // 量能统计（复用已有 1h×504 数据，不新增 API 请求）
    const volumes = ohlcvRaw.slice(-96).map((c: any) => Number(c[5])); // 最近 96h（4天）
    state.lastVolume24h = volumes.slice(-24).reduce((s: number, v: number) => s + v, 0);  // 最近 24h
    const vol72h = volumes.slice(0, 72).reduce((s: number, v: number) => s + v, 0);        // 前 72h（3天）
    state.avgDailyVolume = vol72h / 3;

    // RSI 背离检测（复用已有 ohlcvRaw，不新增 API 请求）
    // +26: calculateSeries 内部 MACD 需 26 根预热，确保返回完整 20 个 RSI 值
    if (this.indicators && ohlcvRaw.length >= RSI_DIVERGENCE_LOOKBACK + 26) {
      const ohlcvFormatted = ohlcvRaw.map((c: any) => ({
        timestamp: Number(c[0]), open: Number(c[1]),
        high: Number(c[2]),      low:  Number(c[3]),
        close: Number(c[4]),     volume: Number(c[5]),
      }));
      const { rsiSeries } = this.indicators.calculateSeries(ohlcvFormatted, RSI_DIVERGENCE_LOOKBACK);
      const recentCloses = ohlcvRaw.slice(-RSI_DIVERGENCE_LOOKBACK).map((c: any) => Number(c[4]));
      state.rsiDivergenceType = this.detectRsiDivergence(rsiSeries, recentCloses);
    }

    // ATR Spike 比率：当前 ATR(14) vs 近期基线 ATR 均值
    if (this.indicators && highs.length >= 84) {
      const currentATR = this.indicators.calculateATR(highs.slice(-14), lows.slice(-14), closes.slice(-14), 14) ?? 0;
      // 基线：用倒数 15-84 根（共 70 根）逐窗口计算 ATR 均值
      let baseATRSum = 0;
      let baseATRCount = 0;
      for (let i = highs.length - 84; i <= highs.length - 15; i++) {
        const windowATR = this.indicators.calculateATR(
          highs.slice(i, i + 14), lows.slice(i, i + 14), closes.slice(i, i + 14), 14,
        ) ?? 0;
        if (windowATR > 0) { baseATRSum += windowATR; baseATRCount++; }
      }
      const baseATR = baseATRCount > 0 ? baseATRSum / baseATRCount : 0;
      state.lastAtrSpikeRatio = (baseATR > 0 && currentATR > 0) ? currentATR / baseATR : 0;
    }
  }

  /** 检测价格-RSI 背离（前后各半段对比法，防微小波动误触发） */
  private detectRsiDivergence(
    rsiSeries: number[],
    closes: number[],
  ): 'bullish' | 'bearish' | 'none' {
    if (rsiSeries.length < 6 || closes.length < 6) return 'none';
    const n = Math.min(rsiSeries.length, closes.length);
    const half = Math.floor(n / 2);

    const firstRsi    = rsiSeries.slice(0, half);
    const secondRsi   = rsiSeries.slice(-half);
    const firstClose  = closes.slice(0, half);
    const secondClose = closes.slice(-half);

    const f_rsiMax   = Math.max(...firstRsi);    const s_rsiMax   = Math.max(...secondRsi);
    const f_rsiMin   = Math.min(...firstRsi);    const s_rsiMin   = Math.min(...secondRsi);
    const f_closeMax = Math.max(...firstClose);  const s_closeMax = Math.max(...secondClose);
    const f_closeMin = Math.min(...firstClose);  const s_closeMin = Math.min(...secondClose);

    // 双重阈值过滤：价格偏差 > 0.5%、RSI 偏差 > 2 点，防止噪音误判
    const PRICE_THRESHOLD = 0.005;
    const RSI_THRESHOLD   = 2;

    // bearish: 价格创新高，但 RSI 未创新高
    if (
      s_closeMax > f_closeMax * (1 + PRICE_THRESHOLD) &&
      s_rsiMax < f_rsiMax - RSI_THRESHOLD
    ) return 'bearish';

    // bullish: 价格创新低，但 RSI 未创新低
    if (
      s_closeMin < f_closeMin * (1 - PRICE_THRESHOLD) &&
      s_rsiMin > f_rsiMin + RSI_THRESHOLD
    ) return 'bullish';

    return 'none';
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

  /** 确认突破（OI 过滤真假突破） */
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

    // OI 过滤：真突破立即确认，可疑时要求更多次数
    const oiChange = state.currentOIChange ?? 0;
    const isOIEnhanced = (direction === 'up' && oiChange > BREAKOUT_OI_TRUE_THRESHOLD) ||
                         (direction === 'down' && oiChange < -BREAKOUT_OI_TRUE_THRESHOLD);
    if (isOIEnhanced) {
      this.logger.log(`[网格] OI 增强突破(${oiChange.toFixed(1)}%) → 立即确认`);
      return true;
    }
    const required = Math.abs(oiChange) < BREAKOUT_OI_FALSE_THRESHOLD
      ? BREAKOUT_CONFIRM_REQUIRED_OI_SUSPICIOUS  // OI 平稳可疑：5 次
      : BREAKOUT_CONFIRM_REQUIRED;               // 正常：3 次
    return state.breakoutConfirmCount >= required;
  }

  /** 突破动作映射 */
  private getBreakoutAction(level: BreakoutLevel, enableDirectionAdjust = false): BreakoutAction {
    if (enableDirectionAdjust) {
      switch (level) {
        case 'short': return 'adjust_direction'; // 短期突破：偏向调整
        case 'mid':   return 'adjust_direction'; // 中期突破：完全方向切换
        case 'long':  return 'close_all';        // 长期突破：紧急平仓
        default: return 'none';
      }
    }
    switch (level) {
      case 'short': return 'reduce_position'; // 仓位缩减，AI 决策是否 pause
      case 'mid': return 'pause_grid';        // 中期突破：后端暂停，等 AI/价格回归
      case 'long': return 'close_all';        // 长期突破：紧急平仓
      default: return 'none';
    }
  }

  /** 根据突破级别和方向确定新的网格方向（仅 enableDirectionAdjust=true 时调用） */
  private determineGridDirection(
    breakoutLevel: BreakoutLevel,
    breakoutDir: 'up' | 'down',
  ): GridDirection {
    if (breakoutLevel === 'short') {
      return breakoutDir === 'up' ? 'long_bias' : 'short_bias';
    }
    if (breakoutLevel === 'mid') {
      return breakoutDir === 'up' ? 'long' : 'short';
    }
    return 'neutral';
  }

  /** 价格回归后方向逐步恢复中性（nofx 同款逻辑） */
  private determineRecoveryDirection(currentDirection: GridDirection): GridDirection {
    switch (currentDirection) {
      case 'long':       return 'long_bias';
      case 'short':      return 'short_bias';
      case 'long_bias':  return 'neutral';
      case 'short_bias': return 'neutral';
      default:           return 'neutral';
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

  /** 虚假突破恢复检查（仅恢复暂停/仓位缩减，方向由 AI 决策） */
  private checkFalseBreakoutRecovery(state: GridState, price: number): void {
    // 价格回到长期箱体内 → 重置突破状态，解除仓位缩减和后端触发的暂停
    if (
      state.longBoxUpper > 0 && state.longBoxLower > 0 &&
      price >= state.longBoxLower && price <= state.longBoxUpper
    ) {
      const needsReset = state.isPaused || state.positionReductionPct > 0;
      if (needsReset) {
        state.breakoutLevel = 'none';
        state.breakoutDirection = '';
        state.breakoutConfirmCount = 0;
        state.positionReductionPct = 0;
        // 只释放突破类暂停，风控类暂停（pauseSource=risk_control）不能被恢复函数解除
        if (state.pauseSource !== 'risk_control') {
          state.isPaused = false;
          state.pauseReason = undefined;
          state.pauseSource = undefined;
          state.needsReconcile = true; // 下次周期开始前对齐交易所状态
        }
        this.logger.log('[网格] 虚假突破恢复: 价格回到长期箱体内');
      }
    }
  }

  // ========================= 市场状态分类 =========================

  /** 分类市场状态，同时返回 ATR(14)[1h] 供 ATR 追踪网格宽度使用 */
  private async classifyRegime(symbol: string): Promise<{ regime: RegimeLevel; atrHourly: number }> {
    const ohlcvRaw = await this.marketData.fetchOHLCV(symbol, '1h', 50);
    const closes = ohlcvRaw.map((c: any) => Number(c[4]));
    const highs = ohlcvRaw.map((c: any) => Number(c[2]));
    const lows = ohlcvRaw.map((c: any) => Number(c[3]));
    const currentPrice = closes[closes.length - 1] || 0;

    if (!currentPrice || !this.indicators) return { regime: 'standard', atrHourly: 0 };

    const bb = this.indicators.calculateBollingerBands(closes, 20);
    const atr = this.indicators.calculateATR(highs, lows, closes, 14);

    const bbWidth = (bb.upper && bb.middle && bb.lower && bb.middle > 0)
      ? ((bb.upper - bb.lower) / bb.middle) * 100
      : 3; // 默认 standard
    const atrPct = (atr && currentPrice > 0) ? (atr / currentPrice) * 100 : 2;

    let regime: RegimeLevel;
    if (bbWidth < 2.0 && atrPct < 1.0) regime = 'narrow';
    else if (bbWidth <= 3.0 && atrPct <= 2.0) regime = 'standard';
    else if (bbWidth <= 6.0 && atrPct <= 3.0) regime = 'wide';   // 扩大 wide 上限：BB带宽≤6% 且 ATR/价格≤3%
    else regime = 'volatile'; // 真正高波动：BB带宽>6% 或 ATR/价格>3%（hourly ATR>3% 极端罕见）

    return { regime, atrHourly: atr ?? 0 };
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
    // 三周期 OHLCV 并行拉取（5m+1h+4h）
    const [ohlcvFastRaw, ohlcvSlowRaw, ohlcv4hRaw] = await Promise.all([
      this.marketData.fetchOHLCV(state.symbol, '5m', 50),   // 快速：RSI/MACD/短期信号
      this.marketData.fetchOHLCV(state.symbol, '1h', 100),  // 中速：趋势/ATR/价格变化/24h范围
      this.marketData.fetchOHLCV(state.symbol, '4h', 50),   // 慢速：中期趋势
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
    const ohlcv4h = mapOHLCV(ohlcv4hRaw);

    // 快速指标（5m）：RSI、MACD、布林带、EMA 等短期信号
    let indFast: any = {};
    // 慢速指标（1h）：ATR 趋势可靠性
    let indSlow: any = {};
    // 4h 指标：中期趋势判断
    let ind4h: any = {};
    if (this.indicators) {
      indFast = this.indicators.calculateAll(ohlcv5m);
      indSlow = this.indicators.calculateAll(ohlcvHourly);
      ind4h = this.indicators.calculateAll(ohlcv4h);
    }
    this.logger.debug(
      `[网格] 4h指标: RSI=${ind4h.rsi?.toFixed(1) ?? 'N/A'}, ` +
      `EMA20=${ind4h.ema?.ema20?.toFixed(2) ?? 'N/A'}, EMA50=${ind4h.ema?.ema50?.toFixed(2) ?? 'N/A'}, ` +
      `ATR=${ind4h.atr?.toFixed(4) ?? 'N/A'}, MACD=${ind4h.macd?.macd?.toFixed(4) ?? 'N/A'} ` +
      `(K线=${ohlcv4h.length}根)`,
    );

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
      state.availableBalance = availableBalance; // 同步到 state，供 AI 上下文展示
      unrealizedPnl = balance.unrealizedPnl;
      state.lastUnrealizedPnl = unrealizedPnl; // 同步到 state，供 saveGridDecisionLog 使用
      marginUsedPct = balance.marginUsedPct ?? 0;

      // 优先使用 Step 3 预取的持仓，避免重复 API 调用
      const positions = prefetchedPositions ?? await adapter.getPositions();
      const baseSymbol = state.symbol.split('/')[0];
      const symPositions = positions.filter((p: any) => p.symbol.includes(baseSymbol));
      const longPos = symPositions.find((p: any) => p.side === 'long');
      const shortPos = symPositions.find((p: any) => p.side === 'short');

      // 净持仓（兼容原有逻辑）
      currentPosition = (longPos?.quantity ?? 0) - (shortPos?.quantity ?? 0);

      // 双向持仓详情（margin/marginRatio 不传给 AI，避免触发保证金管理行为）
      if (longPos) {
        positionLong = {
          quantity: longPos.quantity,
          entryPrice: longPos.entryPrice,
          unrealizedPnl: longPos.unrealizedPnl,
          liquidationPrice: longPos.liquidationPrice,
        };
      }
      if (shortPos) {
        positionShort = {
          quantity: shortPos.quantity,
          entryPrice: shortPos.entryPrice,
          unrealizedPnl: shortPos.unrealizedPnl,
          liquidationPrice: shortPos.liquidationPrice,
        };
      }
    } catch { /* 使用默认值 */ }

    // 资金费率
    let fundingRate = 0;
    try {
      const fr = await this.marketData.fetchFundingRate(state.symbol);
      if (fr) fundingRate = fr.fundingRate;
    } catch { /* 忽略 */ }

    // OI 持仓量变化（直接使用 Step 4.9 已计算的值，避免重复拉取导致 lastOI 更新后 oiChange1h 归零）
    const oiChange1h = state.currentOIChange ?? 0;

    // 价格变化（改用 1h K 线，精确且无临界问题）
    const priceChange1h = ohlcvHourly.length >= 2
      ? ((currentPrice - ohlcvHourly[ohlcvHourly.length - 2].close) / ohlcvHourly[ohlcvHourly.length - 2].close) * 100
      : 0;
    const priceChange4h = ohlcvHourly.length >= 5
      ? ((currentPrice - ohlcvHourly[ohlcvHourly.length - 5].close) / ohlcvHourly[ohlcvHourly.length - 5].close) * 100
      : 0;
    // 真实 4h 蜡烛价格变化（优先展示给 AI）
    const priceChange4hReal = ohlcv4h.length >= 2
      ? ((currentPrice - ohlcv4h[ohlcv4h.length - 2].close) / ohlcv4h[ohlcv4h.length - 2].close) * 100
      : undefined;

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
        // empty 层：用 allocatedUSD 算推荐数量（含分布权重）；pending/filled 层：用实际下单量
        quantity: l.orderQuantity > 0
          ? l.orderQuantity
          : l.allocatedUSD > 0 && currentPrice > 0
            ? (l.allocatedUSD * state.leverage) / currentPrice
            : 0,
        positionSize: l.positionSize,     // 实际持仓量（filled 层有效）
        state: (l.state === 'empty' || l.state === 'stopped'
          ? 'cancelled'
          // 兼容旧数据：'short' 状态表示持空头仓位，映射为 'filled'
          : l.state === 'short' ? 'filled' : l.state) as 'pending' | 'filled' | 'cancelled',
        orderId: l.orderId,
        fillPrice: l.positionEntry > 0 ? l.positionEntry : undefined,
        profit: l.unrealizedPnl !== 0 ? l.unrealizedPnl : undefined,
      })),
      activeOrderCount: state.gridLines.filter((l) => l.state === 'pending').length,
      filledLevelCount: state.gridLines.filter((l) => l.state === 'filled' && l.positionSize > 0).length,
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
      // 4h 指标（中期趋势，三周期并行设计）
      rsi4h: ind4h.rsi ?? undefined,
      macd4h: ind4h.macd?.macd ?? undefined,
      macdSignal4h: ind4h.macd?.signal ?? undefined,
      atr4h: ind4h.atr ?? undefined,
      ema20_4h: ind4h.ema?.ema20 ?? undefined,
      ema50_4h: ind4h.ema?.ema50 ?? undefined,
      priceChange4hReal,
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
      rsiDivergenceType: state.rsiDivergenceType,  // RSI 背离信号（Phase 12）
      // K线历史（最近30根1h蜡烛，供AI判断趋势/支撑阻力）
      ohlcv: ohlcvHourly.slice(-30).map(c => ({
        open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
      })),
      userLockedRange: state.userLockedRange ?? false,
      stopLossPct: state.stopLossPct > 0 ? state.stopLossPct : undefined,
      currentRegime: state.currentRegime,  // 后端检测的市场形态，与 UI 显示一致
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
    locale?: string,
  ): Promise<{ executed: boolean; skipReason?: string }> {
    const { action } = decision;

    const aiLevel = decision.level_index ?? decision.level;
    this.logger.debug(`[网格] 执行决策: action=${this.actionLabel(action, locale)}, AI层号=${aiLevel}, qty=${decision.quantity}, price=${decision.price}`);

    switch (action) {
      // AI 驱动补单
      case 'place_buy_limit':
        if (!isGridAdapter(adapter)) return { executed: false, skipReason: 'adapter 不支持 Grid' };
        return this.placeGridLimitOrder(state, decision, 'buy', adapter as GridExchangeAdapter, useMakerOnly);

      case 'place_sell_limit':
        if (!isGridAdapter(adapter)) return { executed: false, skipReason: 'adapter 不支持 Grid' };
        return this.placeGridLimitOrder(state, decision, 'sell', adapter as GridExchangeAdapter, useMakerOnly);

      case 'cancel_order': {
        // AI 提示词用 orderId (camelCase)，兼容 order_id (snake_case)
        const cancelOrderId = (decision as any).orderId ?? decision.order_id;
        if (cancelOrderId && isGridAdapter(adapter)) {
          // 校验 orderId 是否存在于本地 orderBook（防止 AI 编造无效 ID 发给交易所）
          if (state.orderBook[cancelOrderId] === undefined) {
            this.logger.warn(`[网格] cancel_order 跳过: orderId=${cancelOrderId} 不在 orderBook 中`);
            break;
          }
          try {
            await (adapter as GridExchangeAdapter).cancelOrder(state.symbol, cancelOrderId);
          } catch (e: any) {
            // 交易所返回"订单不存在/已成交"类错误 — 本地状态仍需清理
            this.logger.warn(`[网格] cancel_order 交易所调用失败: ${e.message}，仍清理本地状态（幂等）`);
          } finally {
            const levelIdx = state.orderBook[cancelOrderId];
            if (levelIdx !== undefined && state.gridLines[levelIdx]) {
              state.gridLines[levelIdx].state = 'empty';
              state.gridLines[levelIdx].orderId = undefined;
            }
            delete state.orderBook[cancelOrderId];
          }
        } else if (!cancelOrderId) {
          this.logger.warn(`[网格] cancel_order 跳过: AI 未提供 orderId（reasoning: ${decision.reasoning?.slice(0, 60)}）`);
        }
        break;
      }

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
        // AI 的 pause_grid 实际执行：取消挂单 + 设 isPaused=true
        // pauseSource='ai' 允许 checkFalseBreakoutRecovery 在价格回归后自动恢复
        // （区别于 pauseSource='risk_control'，后者需手动干预）
        // 传入 adapter 避免 softPauseGrid 内部创建同一缓存实例后 dispose，导致主循环后续（syncOrderFills）报"未初始化"
        await this.softPauseGrid(
          state, userId, apiKeyId,
          decision.reasoning?.slice(0, 120) ?? 'AI pause_grid',
          'ai',
          adapter,
        );
        return { executed: true };


      case 'resume_grid':
        if (state.pauseSource === 'risk_control') {
          this.logger.warn(`[网格] AI 尝试解除风控暂停被拦截: ${state.pauseReason}`);
          break;
        }
        state.isPaused = false;
        state.pauseReason = undefined;
        state.pauseSource = undefined;
        state.needsReconcile = true; // 下次周期开始前对齐交易所状态
        break;

      case 'adjust_grid': {
        await adapter.cancelAllOrders(state.symbol);
        // 后端自动以当前价为中心重建网格（AI 不指定边界）
        const newPrice = currentPrice ?? state.lastPrice;
        await this.reinitializeGridLevels(state, newPrice);
        break;
      }

      case 'close_long': {
        // AI 主动平多仓
        if (!isGridAdapter(adapter)) return { executed: false, skipReason: 'adapter 不支持 Grid' };
        const rawLevel = decision.level_index ?? decision.level ?? 0;
        const levelIndex = rawLevel > 0 ? rawLevel - 1 : -1;
        const targetLevel = levelIndex >= 0
          ? state.gridLines[levelIndex]
          : state.gridLines.find(l => l.state === 'filled' && l.positionSize > 0 && l.side === 'buy');
        const qty = decision.quantity ?? targetLevel?.positionSize ?? 0;
        if (qty <= 0) return { executed: false, skipReason: '无持仓可平' };
        await (adapter as GridExchangeAdapter).closeLong(state.symbol, qty);
        if (targetLevel && targetLevel.positionSize > 0) {
          const grossProfit = (currentPrice ?? state.lastPrice) - targetLevel.positionEntry;
          const netProfit = grossProfit * targetLevel.positionSize
            - (currentPrice ?? state.lastPrice) * targetLevel.positionSize * state.takerFeeRate
            - targetLevel.positionEntry * targetLevel.positionSize * state.takerFeeRate;
          state.totalProfit += netProfit;
          state.dailyTotalProfit = (state.dailyTotalProfit ?? 0) + netProfit;
          state.totalTrades++;
          if (netProfit > 0) state.winningTrades++;
          if (netProfit > 0) await this.settleGridFee(state, userId, netProfit);
          targetLevel.unrealizedPnl = netProfit;
          targetLevel.state = 'empty';
          targetLevel.positionSize = 0;
          targetLevel.positionEntry = 0;
          delete state.orderBook[targetLevel.orderId ?? ''];
          targetLevel.orderId = undefined;
          // 同轮内更新 livePositionNotional，防止后续 cap check 仍计入已平的持仓
          const closedValue = qty * (currentPrice ?? state.lastPrice);
          state.livePositionNotional = Math.max(0, (state.livePositionNotional ?? 0) - closedValue);
          this.logger.log(`[网格] close_long 平仓: level=${targetLevel.index}, profit=${netProfit >= 0 ? '+' : ''}${netProfit.toFixed(4)} USDT`);
          // 取消上方相邻 pending 卖单（孤儿防护：平多后卖单若触价会意外开空）
          const orphanSell = state.gridLines.find(
            (l) => l.state === 'pending' && l.side === 'sell' && l.orderId && l.index === targetLevel.index + 1,
          );
          if (orphanSell?.orderId) {
            try {
              await (adapter as GridExchangeAdapter).cancelOrder(state.symbol, orphanSell.orderId);
              delete state.orderBook[orphanSell.orderId];
              orphanSell.state = 'empty';
              orphanSell.orderId = undefined;
              this.logger.log(`[网格] close_long 后取消孤儿卖单: level=${orphanSell.index}`);
            } catch (e: any) {
              this.logger.warn(`[网格] 取消孤儿卖单失败: level=${orphanSell.index}, ${e.message}`);
            }
          }
        }
        return { executed: true };
      }

      case 'close_short': {
        // AI 主动平空仓
        if (!isGridAdapter(adapter)) return { executed: false, skipReason: 'adapter 不支持 Grid' };
        const rawLevel = decision.level_index ?? decision.level ?? 0;
        const levelIndex = rawLevel > 0 ? rawLevel - 1 : -1;
        const targetLevel = levelIndex >= 0
          ? state.gridLines[levelIndex]
          : state.gridLines.find(l => l.state === 'filled' && l.positionSize > 0 && l.side === 'sell');
        const qty = decision.quantity ?? targetLevel?.positionSize ?? 0;
        if (qty <= 0) return { executed: false, skipReason: '无持仓可平' };
        await (adapter as GridExchangeAdapter).closeShort(state.symbol, qty);
        if (targetLevel && targetLevel.positionSize > 0) {
          const grossProfit = targetLevel.positionEntry - (currentPrice ?? state.lastPrice);
          const netProfit = grossProfit * targetLevel.positionSize
            - (currentPrice ?? state.lastPrice) * targetLevel.positionSize * state.takerFeeRate
            - targetLevel.positionEntry * targetLevel.positionSize * state.takerFeeRate;
          state.totalProfit += netProfit;
          state.dailyTotalProfit = (state.dailyTotalProfit ?? 0) + netProfit;
          state.totalTrades++;
          if (netProfit > 0) state.winningTrades++;
          if (netProfit > 0) await this.settleGridFee(state, userId, netProfit);
          targetLevel.unrealizedPnl = netProfit;
          targetLevel.state = 'empty';
          targetLevel.positionSize = 0;
          targetLevel.positionEntry = 0;
          delete state.orderBook[targetLevel.orderId ?? ''];
          targetLevel.orderId = undefined;
          // 同轮内更新 livePositionNotional，防止后续 cap check 仍计入已平的持仓
          const closedValueShort = qty * (currentPrice ?? state.lastPrice);
          state.livePositionNotional = Math.max(0, (state.livePositionNotional ?? 0) - closedValueShort);
          this.logger.log(`[网格] close_short 平仓: level=${targetLevel.index}, profit=${netProfit >= 0 ? '+' : ''}${netProfit.toFixed(4)} USDT`);
          // 取消下方相邻 pending 买单（孤儿防护：平空后买单若触价会意外开多）
          const orphanBuy = state.gridLines.find(
            (l) => l.state === 'pending' && l.side === 'buy' && l.orderId && l.index === targetLevel.index - 1,
          );
          if (orphanBuy?.orderId) {
            try {
              await (adapter as GridExchangeAdapter).cancelOrder(state.symbol, orphanBuy.orderId);
              delete state.orderBook[orphanBuy.orderId];
              orphanBuy.state = 'empty';
              orphanBuy.orderId = undefined;
              this.logger.log(`[网格] close_short 后取消孤儿买单: level=${orphanBuy.index}`);
            } catch (e: any) {
              this.logger.warn(`[网格] 取消孤儿买单失败: level=${orphanBuy.index}, ${e.message}`);
            }
          }
        }
        return { executed: true };
      }

      case 'hold':
        // 对齐 nofx: hold 时打印 reasoning，便于终端日志追踪 AI 决策理由
        if (decision.reasoning) {
          this.logger.log(`[网格] ${this.actionLabel('hold', locale)}: ${decision.reasoning}`);
        }
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

    // 清除暂停状态，恢复正常运行
    state.isPaused = false;
    state.pauseSource = undefined;
    state.pauseReason = undefined;

    // 权益基准归位（回撤检测从当前权益重新开始）
    if (state.lastEquity && state.lastEquity > 0) {
      state.startEquity = state.lastEquity;
    }
    // totalProfit / dailyTotalProfit 保留（止盈止损触发百分比由用户在配置里调整）
    state.chargedProfit = 0;
    // peakEquity/maxDrawdown 归零，防止旧回撤值立刻再次触发保护
    state.peakEquity = state.startEquity;
    state.maxDrawdown = 0;

    state.peakEquity = state.startEquity;   // 回撤检测从新基准重新开始
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

    // Backend Guard: 若 AI 在 filled buy 层挂卖单（出=入价 → 零利润+手续费=亏损），自动重定向到 N+1
    // nofx 设计：每个 filled 买入层(N) 对应的止盈卖单应挂在层 N+1（更高价）
    if (side === 'sell' && level && level.state === 'filled' && level.side === 'buy') {
      const redirectIndex = levelIndex + 1;
      const redirectLevel = redirectIndex < state.gridLines.length ? state.gridLines[redirectIndex] : undefined;
      if (redirectLevel) {
        this.logger.warn(
          `[网格] Backend Guard: AI 请求在 filled buy 层 ${levelIndex + 1} 挂卖单（出=入=$${level.price.toFixed(4)}）→ 自动重定向到层 ${redirectIndex + 1}（$${redirectLevel.price.toFixed(4)}）`,
        );
        // 重定向到 N+1：用 N+1 层的价格和索引
        decision.level = redirectIndex + 1;  // 1-based
        decision.level_index = redirectIndex + 1;
        decision.price = redirectLevel.price;
        // 重新绑定 level 变量指向 N+1
        const newLevel = redirectLevel;
        // 若 N+1 层已有 pending 挂单，先取消（防重复）
        if (newLevel.state === 'pending' && newLevel.orderId) {
          try {
            await adapter.cancelOrder(state.symbol, newLevel.orderId);
          } catch (_e) { /* 忽略，由 syncOrderFills 处理 */ }
          delete state.orderBook[newLevel.orderId];
          newLevel.state = 'empty';
          newLevel.orderId = undefined;
        }
      } else {
        // N+1 超出边界（已是最高层），跳过此单
        const skipReason = `filled buy 层 ${levelIndex + 1} 已是最高层，无法重定向到 N+1`;
        this.logger.warn(`[网格] Backend Guard: ${skipReason}`);
        return { executed: false, skipReason };
      }
    }

    // 重新读取（可能被 Backend Guard 更新）
    const rawLevel2 = decision.level_index ?? decision.level ?? 0;
    const finalLevelIndex = rawLevel2 > 0 ? rawLevel2 - 1 : levelIndex;
    const finalLevel = finalLevelIndex >= 0 ? state.gridLines[finalLevelIndex] : level;

    // Fix-3: 价格选取规则：
    // - 买单(buy)：优先使用网格预设价格（由 initGrid/adjust_grid 数学计算），AI 价格仅作 fallback
    //   防止 adjust_grid 与 place 同批次时 AI 旧价格覆盖刚重算的正确价格
    // - 卖单(sell)在已成交(filled)层上：使用 AI 建议价格（即止盈目标价），不用格线买入价
    //   否则格线买入价 < 市价 → 立即成交开空，而非止盈平多
    const isSellOnFilledLevel = side === 'sell' && finalLevel && finalLevel.state === 'filled';
    const price = isSellOnFilledLevel
      ? (decision.price ?? finalLevel!.price)
      : ((finalLevel && finalLevel.price > 0) ? finalLevel.price : (decision.price ?? 0));

    if (price <= 0 || quantity <= 0) {
      const skipReason = `无效参数: price=${price}, quantity=${quantity}`;
      this.logger.warn(`[网格] 跳过下单: ${skipReason} (level=${levelIndex})`);
      return { executed: false, skipReason };
    }

    // Step 1: per-level 仓位上限检查
    const leverage = state.effectiveLeverage || state.leverage; // fallback 兼容旧数据
    if (price > 0 && state.totalInvestment > 0) {
      const maxMarginPerLevel = state.totalInvestment / state.gridLines.length;
      let maxQuantityPerLevel = (maxMarginPerLevel * leverage) / price;

      // 使用 level-specific 分配
      if (finalLevel && finalLevel.allocatedUSD > 0) {
        const levelMax = (finalLevel.allocatedUSD * leverage) / price;
        maxQuantityPerLevel = Math.min(maxQuantityPerLevel, levelMax);
      }

      // 仓位缩减（突破恢复后）
      if (state.positionReductionPct > 0) {
        maxQuantityPerLevel *= (1 - state.positionReductionPct / 100);
      }

      if (quantity > maxQuantityPerLevel) {
        this.logger.debug(
          `[网格] ⚠️ 数量截断: ${quantity.toFixed(4)} → ${maxQuantityPerLevel.toFixed(4)} (level=${levelIndex}, max=$${(maxQuantityPerLevel * price).toFixed(2)})`,
        );
      }
      quantity = Math.min(quantity, maxQuantityPerLevel);

      // 总仓位上限：所有 pending+filled 层名义价值 + 本次 ≤ totalInvestment × leverage
      const existingNotional = state.gridLines.reduce((sum, l) => {
        if (l.state === 'pending' || l.state === 'filled') {
          const qty = l.orderQuantity > 0 ? l.orderQuantity : (l.positionSize ?? 0);
          return sum + qty * price;
        }
        return sum;
      }, 0);
      const totalPositionCap = state.totalInvestment * leverage;
      if (existingNotional + quantity * price > totalPositionCap) {
        // 削减至剩余可用额度
        const remaining = Math.max(0, totalPositionCap - existingNotional);
        quantity = Math.min(quantity, remaining / price);
        if (quantity <= 0) {
          return { executed: false, skipReason: `总仓位已满: 已用 $${existingNotional.toFixed(2)} / 上限 $${totalPositionCap.toFixed(2)}` };
        }
      }

      // 绝对安全上限（兜底：totalInvestment × leverage × POSITION_SAFETY_MULTIPLIER）
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

    // Step 2.4: Bid/Ask Spread 检测
    // spread 过宽时跳过本格下单，避免在流动性差时挂单被吃成本
    if (state.lastBidAskSpread > 0) {
      const maxSpread = MAX_SPREAD_PCT;
      if (state.lastBidAskSpread > maxSpread) {
        const skipReason = `spread过宽(${state.lastBidAskSpread.toFixed(3)}% > ${maxSpread}%)`;
        this.logger.debug(`[网格] ${skipReason}，跳过本格 level=${levelIndex}`);
        return { executed: false, skipReason };
      }
    }

    // Step 2.4.1: 盘口深度检测（Phase 12）
    // 买卖任一方 top-5 档深度 < $1000 → 流动性极差，跳过下单
    // 初始值 -1 表示未取到数据（跳过检测），0 表示空盘口（属于需跳过的最差情况）
    if (state.lastBidDepth >= 0 && state.lastAskDepth >= 0) {
      const minDepth = Math.min(state.lastBidDepth, state.lastAskDepth);
      if (minDepth < MIN_ORDER_BOOK_DEPTH_USD) {
        const skipReason = `盘口深度不足(${minDepth.toFixed(0)} USD < ${MIN_ORDER_BOOK_DEPTH_USD})`;
        this.logger.debug(`[网格] ${skipReason}，跳过本格 level=${levelIndex}`);
        return { executed: false, skipReason };
      }
    }

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

    // Step 2.8: 仓位总量检查（名义价值守卫）
    // 对齐 nofx checkTotalPositionLimit：
    //   持仓 = 交易所真实持仓（livePositionNotional，每轮从 GetPositions 更新，消除幽灵持仓影响）
    //   挂单 = 内存 pending 层（同轮次前序成功下单已更新 state='pending'，可正确累计防止过度挂单）
    //   上限 = totalInvestment × leverage
    {
      const orderNominal = finalQty * price;
      const maxTotalNominal = state.totalInvestment * leverage;
      // 持仓：优先用本轮预取的交易所实时值；若未取到（0），降级用内存 filled 层
      // ⚠️ 必须加 state==='filled' 过滤，否则旧版 pending/empty 层残留的 positionSize/positionEntry 脏数据会虚增持仓
      const positionNominal = (state.livePositionNotional ?? 0) > 0
        ? state.livePositionNotional
        : state.gridLines.reduce((sum, l) =>
            (l.state === 'filled' && (l.positionSize ?? 0) > 0 && l.positionEntry > 0)
              ? sum + l.positionSize * l.positionEntry
              : sum, 0);
      let pendingNominal = 0;
      for (const l of state.gridLines) {
        if (l.state === 'pending' && l.orderQuantity > 0 && l.price > 0) {
          pendingNominal += l.orderQuantity * l.price;
        }
      }
      const totalAfterOrder = positionNominal + pendingNominal + orderNominal;
      if (totalAfterOrder > maxTotalNominal) {
        const skipReason =
          `仓位总量超限: 持仓$${positionNominal.toFixed(2)}(实时) + 挂单$${pendingNominal.toFixed(2)} + 本单$${orderNominal.toFixed(2)}` +
          ` = $${totalAfterOrder.toFixed(2)} > 上限$${maxTotalNominal.toFixed(2)}`;
        this.logger.warn(`[网格] 跳过下单(仓位总量检查): ${skipReason}`);
        return { executed: false, skipReason };
      }
    }

    // Step 2.9: 不做 availableBalance 预检
    // 只做静态 qty 上限（totalInvestment/gridCount），不在运行时检查余额
    // 保证金不足时由交易所返回错误（-2019/51008），上层 catch 记录日志后继续下一个决策
    // 下一轮 AI 重新评估空格，自然补挂 — "信号生成 → 直接挂单 → 交易所裁判"

    // Step 3: 下单
    // OKX 双向持仓模式需要 positionSide（对应 OKX 参数 posSide）：
    //   BUY  → 多头/中性 开多(long)；空头方向 关空(short)
    //   SELL → 多头/中性 关多(long)；空头方向 开空(short)
    // OKX 双向持仓模式每笔单都必须指定 posSide
    // 单向持仓模式（Binance默认/OKX net_mode）不传 positionSide，避免 -4061/51015 错误
    // OKX 要求 clOrdId 纯字母数字（无连字符），格式 g{idx}t{ts}，最长 17 字符
    const clientId = finalLevel ? `g${finalLevelIndex}t${Date.now()}` : undefined;

    // OKX 网格挂单：不发 posSide
    // - net_mode（单向）: 不支持 posSide，发了就 51000
    // - long_short_mode（双向）: 空网格下 sell+posSide='long' = 平多，但没有多头会 51000
    // 结论：网格限价单始终不发 positionSide，让 OKX 按账户默认单向模式处理
    const positionSide: 'long' | 'short' | undefined = undefined;

    const result = await adapter.placeLimitOrder({
      symbol: state.symbol,
      side,
      price,
      quantity: finalQty,
      leverage,
      postOnly: useMakerOnly,
      clientId,
      positionSide,
    });

    // Step 4: 更新本地状态
    if (finalLevel) {
      // 如果层上仍残留旧 orderId（极端并发情况），先从 orderBook 清理，防止孤儿条目
      if (finalLevel.orderId && finalLevel.orderId !== result.orderId) {
        delete state.orderBook[finalLevel.orderId];
      }
      finalLevel.state = 'pending';
      finalLevel.price = price;           // 与实际下单价保持一致
      finalLevel.orderId = result.orderId;
      finalLevel.orderQuantity = finalQty;
      state.orderBook[result.orderId] = finalLevelIndex;
    }

    this.logger.log(`[网格] 限价单: ${side} ${finalQty} @ ${price} (level=${finalLevelIndex}, orderId=${result.orderId})`);
    return { executed: true };
  }

  // ========================= DB 持仓记录同步 =========================

  /**
   * 平仓后同步 DB：将 positions 表中的快照记录更新为真实平仓数据
   * 所有平仓路径（emergencyExit、方向性平仓、方向调整、逐层止损）统一调用此方法
   * - 使用交易所实际返回的 qty / avgPrice / realizedPnl（比 snapshot 更准确）
   * - 失败不阻塞平仓流程（non-fatal）
   */
  private async syncDbPositionClose(
    userId: string,
    symbol: string,
    side: string,
    actualQty: number,
    closeReason: string,
    closeResult: { avgPrice?: number; realizedPnl?: number },
  ): Promise<void> {
    try {
      const baseSymbol = symbol.split('/')[0].replace(/USDT.*|:.*/, '');
      const snapshot = await this.prisma.position.findFirst({
        where: {
          userId,
          symbol: { contains: baseSymbol },
          side,
          status: 'open',
          source: { in: ['snapshot', 'ai_strategy'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!snapshot) return;

      const { avgPrice, realizedPnl } = closeResult;
      await this.prisma.position.update({
        where: { id: snapshot.id },
        data: {
          status: 'closed',
          closeReason,
          closedAt: new Date(),
          amount: actualQty,   // 交易所实际仓量（比快照初始值更准确）
          ...(avgPrice ? { closePrice: avgPrice.toFixed(8), exitPrice: avgPrice.toFixed(8) } : {}),
          ...(realizedPnl != null ? { pnl: realizedPnl.toFixed(8), realizedPnl: realizedPnl.toFixed(8) } : {}),
        },
      });
      this.logger.log(
        `[网格] DB持仓同步: ${symbol} ${side} → closed (${closeReason}), ` +
        `qty=${actualQty}, pnl=${(realizedPnl ?? 0).toFixed(4)} USDT`,
      );
    } catch (e: any) {
      this.logger.warn(`[网格] DB持仓同步失败(非致命): ${e.message}`);
    }
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
          const dirCloseResult = sideToClose === 'long'
            ? await adapter.closeLong(pos.symbol, pos.quantity)
            : await adapter.closeShort(pos.symbol, pos.quantity);
          await this.settleGridFee(state, userId, dirCloseResult.realizedPnl ?? 0);
          await this.syncDbPositionClose(userId, pos.symbol, sideToClose, pos.quantity, 'directional_breakout', dirCloseResult);
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

      // 逐仓平仓：平仓后立即用交易所返回的已实现盈亏结算燃油费
      const positions = await adapter.getPositions();
      const baseSymbol = state.symbol.split('/')[0];
      let totalClosingPnl = 0;

      for (const pos of positions) {
        if (!pos.symbol.includes(baseSymbol)) continue;
        try {
          const closeResult = pos.side === 'long'
            ? await adapter.closeLong(pos.symbol, pos.quantity)
            : await adapter.closeShort(pos.symbol, pos.quantity);

          // 优先使用交易所返回的已实现盈亏，fallback 到平仓前的 unrealizedPnl（近似值）
          const posRealizedPnl = closeResult.realizedPnl ?? pos.unrealizedPnl;
          totalClosingPnl += posRealizedPnl;

          this.logger.log(
            `[网格] 平仓 ${pos.symbol} ${pos.side}: 已实现盈亏 ${posRealizedPnl >= 0 ? '+' : ''}${posRealizedPnl.toFixed(4)} USDT`,
          );

          // 单仓平仓后立即结算燃油费（亏损不扣，失败不阻塞）
          await this.settleGridFee(state, userId, posRealizedPnl);
          // 同步 DB 持仓记录（使用交易所实际数据覆盖快照）
          await this.syncDbPositionClose(userId, pos.symbol, pos.side, pos.quantity, 'emergency_exit', closeResult);
        } catch (e: any) {
          this.logger.warn(`[网格] 平仓失败: ${pos.symbol} ${pos.side} - ${e.message}`);
        }
      }

      this.logger.log(
        `[网格] 紧急退出合计盈亏: ${totalClosingPnl >= 0 ? '+' : ''}${totalClosingPnl.toFixed(4)} USDT`,
      );
      state.dailyTotalProfit = (state.dailyTotalProfit ?? 0) + totalClosingPnl;
      state.totalProfit = (state.totalProfit ?? 0) + totalClosingPnl;
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
   * 软暂停：只取消挂单，不平仓
   * 适用于日内亏损等可能自然恢复的场景，避免把浮亏变实亏
   */
  private async softPauseGrid(
    state: GridState,
    userId: string,
    apiKeyId: string,
    reason: string,
    pauseSource: GridState['pauseSource'] = 'risk_control',
    existingAdapter?: ExchangeAdapter | null,  // 传入时直接复用，不 dispose（避免销毁主循环共享实例）
  ): Promise<void> {
    this.logger.warn(`[网格] 软暂停（取消挂单/保留持仓）: ${reason}`);

    if (existingAdapter) {
      // 使用调用方传入的 adapter，不创建也不 dispose，避免销毁主循环仍在使用的共享实例
      try {
        await existingAdapter.cancelAllOrders(state.symbol);
      } catch (e: any) {
        this.logger.warn(`[网格] 软暂停撤单失败（忽略继续暂停）: ${e.message}`);
      }
    } else if (this.adapterFactory) {
      // 自建 adapter，用完后 dispose（调用方没有可用实例的情况，如日内亏损保护）
      let adapter: ExchangeAdapter | null = null;
      try {
        adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
        await adapter.cancelAllOrders(state.symbol);
      } catch (e: any) {
        this.logger.warn(`[网格] 软暂停撤单失败（忽略继续暂停）: ${e.message}`);
      } finally {
        if (adapter) { try { await adapter.dispose(); } catch { /* 忽略 */ } }
      }
    } else {
      state.isPaused = true;
      state.pauseSource = pauseSource;
      state.pauseReason = reason;
      return;
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
    state.pauseSource = pauseSource;
    state.pauseReason = reason;
  }

  // ========================= 燃油费结算 =========================

  /**
   * 结算网格策略的点卡燃油费
   * - 基于本次平仓的实际盈亏（平仓后权益 - 平仓前权益）
   * - 亏损不扣费，失败不影响平仓流程（非致命错误）
   */
  private async settleGridFee(state: GridState, userId: string, realizedPnl: number): Promise<void> {
    if (!this.feeService) return;
    const actualPnl = realizedPnl;
    if (actualPnl <= 0) return;

    try {
      const feeCalc = await this.feeService.calculateFee(userId, actualPnl.toFixed(8));
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
          strategyName: state.symbol,
        });
        state.chargedProfit = state.totalProfit; // 高水位标记（防止重启后重复扣费）
        this.logger.log(
          `[网格] 燃油费结算: 实际盈亏=${actualPnl.toFixed(2)} USDT, ` +
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

  /**
   * 同步交易所订单到本地状态（持仓对比启发式）
   *
   * 逻辑：getOpenOrders + getPositions
   * - 挂单消失 && 实际持仓 > 内存预期持仓 → 成交
   * - 挂单消失 && 实际持仓 ≤ 内存预期持仓 → 取消/过期
   */
  private async syncOrderFills(
    state: GridState,
    adapter: GridExchangeAdapter,
    userId?: string,
  ): Promise<{ filledLines: GridLine[] }> {
    const filledLines: GridLine[] = [];
    try {
      // Step 1: 获取交易所当前挂单（实时）
      const openOrders = await adapter.getOpenOrders(state.symbol);
      const activeIds = new Set(openOrders.map((o) => o.orderId));

      // Step 2: 获取交易所当前持仓（实时，对齐 nofx — 每轮无条件 GetPositions，不复用缓存）
      let currentPositionSize = 0;
      try {
        const positions = await adapter.getPositions();
        const baseSymbol = state.symbol.split('/')[0];
        for (const pos of positions) {
          if ((pos as any).symbol?.includes(baseSymbol)) {
            const side = (pos as any).side;
            const qty = (pos as any).quantity ?? 0;
            if (side === 'long' || side === 'net' || !side) {
              currentPositionSize += qty;
            } else if (side === 'short') {
              currentPositionSize -= qty;
            }
          }
        }
      } catch (e: any) {
        this.logger.warn(`[网格] syncOrderFills 持仓读取失败，退化为保守模式（所有消失挂单视为取消）: ${e.message}`);
      }

      // Step 3: 内存中 filled 层的预期持仓
      const expectedPositionSize = state.gridLines
        .filter((l) => l.state === 'filled')
        .reduce((sum, l) => sum + (l.positionSize ?? 0), 0);

      // Step 4: 处理"消失"的 pending 层
      const disappearedLines = state.gridLines.filter(
        (line) => line.state === 'pending' && line.orderId && !activeIds.has(line.orderId),
      );

      this.logger.debug(
        `[网格] syncOrderFills: 交易所挂单=${openOrders.length}, 内存pending=${state.gridLines.filter(l => l.state === 'pending').length}, 消失=${disappearedLines.length}, currentPos=${currentPositionSize.toFixed(4)}, expectedPos=${expectedPositionSize.toFixed(4)}`,
      );

      for (const line of disappearedLines) {
        const prevOrderId = line.orderId!;
        const posIncreased = currentPositionSize > expectedPositionSize + 0.0001;
        const posDecreased = currentPositionSize < expectedPositionSize - 0.0001;

        if (line.side === 'buy' && posIncreased) {
          // 买单成交：仓位增加
          line.state = 'filled';
          line.positionSize = line.orderQuantity;
          line.positionEntry = line.price;
          line.unrealizedPnl = 0;
          state.totalTrades++;
          filledLines.push(line);
          this.logger.log(`[网格] 买单成交: level=${line.index}, price=${line.price.toFixed(4)}, qty=${line.positionSize.toFixed(4)}`);
        } else if (line.side === 'sell' && posDecreased && currentPositionSize >= -0.0001) {
          // 卖单成交：仓位减少（平多头）
          // 条件额外检查 currentPositionSize >= 0：若仓位变负则说明卖单开了空头，
          // 不应走此分支，交由 Step 6 signMismatch 检测处理
          // 注意：sell pending 层的 positionEntry/positionSize 均为 0（持仓在 filled buy 层）
          // 必须找到对应的 filled buy 层来获取真实入场价和数量
          const filledBuyLevels = state.gridLines
            .filter(l => l.state === 'filled' && l.side === 'buy' && (l.positionSize ?? 0) > 0)
            .sort((a, b) => Math.abs(a.positionEntry - line.price) - Math.abs(b.positionEntry - line.price));
          const matchedBuyLevel = filledBuyLevels[0];

          if (matchedBuyLevel) {
            const exitPrice = line.price; // 卖单价格 = 出场价
            const entryPrice = matchedBuyLevel.positionEntry; // 买单入场价
            const qty = matchedBuyLevel.positionSize;
            const grossProfit = (exitPrice - entryPrice) * qty;
            const fee = (exitPrice + entryPrice) * qty * (state.takerFeeRate ?? 0.0005);
            const netProfit = grossProfit - fee;
            state.totalProfit = (state.totalProfit ?? 0) + netProfit;
            state.dailyTotalProfit = (state.dailyTotalProfit ?? 0) + netProfit;
            state.totalTrades++;
            if (netProfit > 0) state.winningTrades = (state.winningTrades ?? 0) + 1;
            // 同时清除对应的 filled buy 层
            matchedBuyLevel.state = 'empty';
            matchedBuyLevel.positionSize = 0;
            matchedBuyLevel.positionEntry = 0;
            matchedBuyLevel.unrealizedPnl = netProfit;
            if (matchedBuyLevel.orderId) {
              delete state.orderBook[matchedBuyLevel.orderId];
              matchedBuyLevel.orderId = undefined;
            }
            this.logger.log(
              `[网格] 卖单成交(平多): sell_level=${line.index}→buy_level=${matchedBuyLevel.index}, ` +
              `exit=${exitPrice.toFixed(4)}, entry=${entryPrice.toFixed(4)}, qty=${qty.toFixed(4)}, profit=${netProfit.toFixed(4)} USDT`,
            );
            if (netProfit > 0 && userId) {
              await this.settleGridFee(state, userId, netProfit);
            }
          } else {
            this.logger.warn(`[网格] 卖单成交但无匹配持多仓层(可能已被 close_long 清除): level=${line.index}`);
          }
          line.state = 'empty';
          line.positionSize = 0;
          line.positionEntry = 0;
          line.unrealizedPnl = 0;
          filledLines.push(line);
        } else if (line.side === 'buy' && posDecreased && currentPositionSize >= -0.0001 && (line.positionEntry ?? 0) > 0 && (line.positionSize ?? 0) > 0) {
          // isSellOnFilledLevel 场景：AI 在 filled buy 层直接挂了卖单（关多头），现已成交
          // 特征：side='buy'（来自原始 buy fill）但仓位减少了，且层上保留有 positionEntry/positionSize
          // line.price 已在 placeGridLimitOrder 中被覆盖为卖单目标价
          const exitPrice = line.price;
          const entryPrice = line.positionEntry;
          const qty = line.positionSize;
          const grossProfit = (exitPrice - entryPrice) * qty;
          const fee = (exitPrice + entryPrice) * qty * (state.takerFeeRate ?? 0.0005);
          const netProfit = grossProfit - fee;
          state.totalProfit = (state.totalProfit ?? 0) + netProfit;
          state.dailyTotalProfit = (state.dailyTotalProfit ?? 0) + netProfit;
          state.totalTrades++;
          if (netProfit > 0) state.winningTrades = (state.winningTrades ?? 0) + 1;
          line.state = 'empty';
          line.positionSize = 0;
          line.positionEntry = 0;
          line.unrealizedPnl = netProfit;
          filledLines.push(line);
          this.logger.log(`[网格] 持多仓层卖出成交: level=${line.index}, 出价=${exitPrice.toFixed(4)}, 入价=${entryPrice.toFixed(4)}, qty=${qty.toFixed(4)}, 利润=${netProfit.toFixed(4)} USDT`);
          if (netProfit > 0 && userId) {
            await this.settleGridFee(state, userId, netProfit);
          }
        } else {
          // 持仓未变 → 取消/过期
          line.state = 'empty';
          // 清除任何残留的持仓字段，避免 ghost 数据污染后续判断
          line.positionSize = 0;
          line.positionEntry = 0;
          line.unrealizedPnl = 0;
          this.logger.debug(`[网格] 挂单消失（取消/过期）: level=${line.index}`);
        }

        line.orderId = undefined;
        delete state.orderBook[prevOrderId];
      }

      // Step 5: 清理 orderBook 中其他已消失条目
      for (const orderId of Object.keys(state.orderBook)) {
        if (!activeIds.has(orderId)) {
          delete state.orderBook[orderId];
        }
      }

      // Step 6: 幽灵持仓检测
      const updatedExpected = state.gridLines
        .filter(l => l.state === 'filled')
        .reduce((sum, l) => sum + (l.positionSize ?? 0), 0);

      // 6a: 交易所仓位≈0但内存有filled层（外部平仓或之前误判）
      const posApproxZero = Math.abs(currentPositionSize) < 0.0001 && updatedExpected > 0.0001;
      // 6b: 方向相反 — 内存以为持多头但交易所实际是空头（卖单在空仓上执行开了空）
      const signMismatch = currentPositionSize < -0.0001 && updatedExpected > 0.0001;

      if (posApproxZero || signMismatch) {
        const ghosts = state.gridLines.filter(l => l.state === 'filled' && (l.positionSize ?? 0) > 0);
        for (const g of ghosts) {
          this.logger.warn(`[网格] 幽灵持仓清理: level=${g.index}, positionSize=${g.positionSize?.toFixed(4)}`);
          g.state = 'empty';
          g.positionSize = 0;
          g.positionEntry = 0;
          g.unrealizedPnl = 0;
          if (g.orderId) {
            delete state.orderBook[g.orderId];
            g.orderId = undefined;
          }
        }
        // 6b: 方向相反时，还需自动平空（市价买单平掉意外空头）
        if (signMismatch) {
          const shortQty = Math.abs(currentPositionSize);
          this.logger.warn(`[网格] 方向异常自动平空: qty=${shortQty.toFixed(4)}`);
          try {
            await adapter.closeShort(state.symbol, shortQty);
          } catch (e: any) {
            this.logger.error(`[网格] 自动平空失败: ${e.message}`);
          }
        }
      }

      // Step 6c: 孤儿持仓检测
      // 场景：exchange 有多头持仓，但内存无 filled 层（reinitialize 后遗留或 close_long 未成功落地）
      // 对齐 nofx：幽灵持仓必须清理，否则 livePositionNotional 永久占用 cap，阻塞新挂单
      const orphanLong = currentPositionSize > 0.0001 && updatedExpected < 0.0001 && disappearedLines.length === 0;
      if (orphanLong) {
        this.logger.warn(
          `[网格] 孤儿多头持仓: exchange=${currentPositionSize.toFixed(4)}, 内存filled=0, 无成交 → 自动平仓`,
        );
        try {
          await adapter.closeLong(state.symbol, currentPositionSize);
          state.livePositionNotional = 0;
          this.logger.log(`[网格] 孤儿多头已平: qty=${currentPositionSize.toFixed(4)}`);
        } catch (e: any) {
          this.logger.error(`[网格] 孤儿多头平仓失败: ${e.message}`);
        }
      }
    } catch (e: any) {
      this.logger.warn(`[网格] 订单同步失败: ${e.message}`);
    }

    return { filledLines };
  }

  // ========================= 孤儿订单清理（reinitialize 后补充执行） =========================

  /**
   * 取消 exchange 上所有不在当前 orderBook 中的挂单（孤儿）
   * 用于 reinitializeGridLevels 清空 orderBook 之后，防止旧价位挂单持续占用保证金
   */
  private async cancelOrphanOrders(
    _strategyId: string,
    userId: string,
    apiKeyId: string,
    state: GridState,
  ): Promise<void> {
    if (!this.adapterFactory) return;
    try {
      const adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
      if (!isGridAdapter(adapter)) return;

      const openOrders = await adapter.getOpenOrders(state.symbol);
      const trackedIds = new Set(Object.keys(state.orderBook));
      const orphans = openOrders.filter((o) => !trackedIds.has(o.orderId));

      if (orphans.length === 0) return;

      this.logger.warn(
        `[网格] 边界重建后发现 ${orphans.length} 个孤儿订单，取消中: ${orphans.map((o) => o.orderId).join(', ')}`,
      );
      await Promise.allSettled(
        orphans.map((o) =>
          (adapter as GridExchangeAdapter)
            .cancelOrder(state.symbol, o.orderId)
            .catch((e: any) => this.logger.warn(`[网格] 取消孤儿订单 ${o.orderId} 失败: ${e.message}`)),
        ),
      );
      this.logger.log(`[网格] 边界重建孤儿清理完成`);
    } catch (e: any) {
      this.logger.warn(`[网格] cancelOrphanOrders 失败: ${e.message}`);
    }
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
    if (!state) return;
    if (!this.adapterFactory) {
      this.logger.warn(`[网格] reconcile 跳过: adapterFactory 尚未就绪（依赖注入竞态），脏数据将在下次重启后清理`);
      return;
    }

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

        // 孤儿订单清理
        // DB 不认识的交易所挂单 = 孤儿，直接取消，防止保证金被无效锁定
        const trackedIds = new Set(Object.keys(state.orderBook));
        const orphanOrders = openOrders.filter((o) => !trackedIds.has(o.orderId));
        if (orphanOrders.length > 0) {
          this.logger.warn(
            `[网格] 发现 ${orphanOrders.length} 个孤儿订单，取消中: ${orphanOrders.map((o) => o.orderId).join(', ')}`,
          );
          await Promise.allSettled(
            orphanOrders.map((o) =>
              (adapter as GridExchangeAdapter)
                .cancelOrder(state!.symbol, o.orderId)
                .catch((e: any) => this.logger.warn(`[网格] 取消孤儿订单 ${o.orderId} 失败: ${e.message}`)),
            ),
          );
          this.logger.log(`[网格] 孤儿订单清理完成`);
        }
      }

      // ── 读取交易所真实持仓，清除幽灵 filled 层（启动时一次性对齐）──
      const positions = await adapter.getPositions();
      const baseSymbol = state.symbol.split('/')[0];
      const symPositions = positions.filter((p) => p.symbol.includes(baseSymbol));
      // CCXT adapter 已在 getPositions() 中把 OKX net_mode 归一化为 'long'/'short'
      const longPos = symPositions.find((p) => p.side === 'long');
      const exchangeLongQty = longPos?.quantity ?? 0;

      const filledLines = state.gridLines.filter((l) => l.state === 'filled' && l.positionSize > 0);
      const expectedPositionSize = filledLines.reduce((sum, l) => sum + l.positionSize, 0);
      if (expectedPositionSize > 0 && exchangeLongQty === 0) {
        for (const line of filledLines) {
          line.state = 'empty';
          line.positionSize = 0;
          line.positionEntry = 0;
          line.unrealizedPnl = 0;
        }
        this.logger.warn(
          `[网格] reconcile: ${filledLines.length} 层幽灵持仓 filled→empty（交易所多头=0，本地期望=${expectedPositionSize.toFixed(4)}）`,
        );
      }

      // 清理脏数据：state≠'filled' 但 positionSize/positionEntry 仍有残留值（旧版 bug 遗留）
      // 这些脏数据会导致 positionNominal 回退计算虚增 cap，阻塞正常挂单
      const dirtyLines = state.gridLines.filter(
        (l) => l.state !== 'filled' && ((l.positionSize ?? 0) > 0 || l.positionEntry > 0),
      );
      if (dirtyLines.length > 0) {
        this.logger.warn(
          `[网格] reconcile: 清理 ${dirtyLines.length} 条脏数据行（state≠filled 但有残留 positionSize/Entry）: ` +
          dirtyLines.map((l) => `idx=${l.index} state=${l.state} posSize=${l.positionSize?.toFixed(4)} posEntry=${l.positionEntry?.toFixed(4)}`).join(', '),
        );
        for (const line of dirtyLines) {
          line.positionSize = 0;
          line.positionEntry = 0;
          line.unrealizedPnl = 0;
        }
      }

      // 同步持仓状态（快照记录）
      const symPos = symPositions.find((p) => p.side === 'long') ?? symPositions[0];

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
        } else {
          // 快照已存在：同步 amount（网格加仓后交易所持仓量会增加，差异>1%时更新）
          const exchangeQty = symPos.quantity;
          const dbQty = Number(dbPos.amount);
          if (Math.abs(exchangeQty - dbQty) / Math.max(exchangeQty, 0.0001) > 0.01) {
            await this.prisma.position.update({
              where: { id: dbPos.id },
              data: { amount: exchangeQty },
            });
            this.logger.debug(`[网格] 快照 amount 更新: ${dbQty.toFixed(4)} → ${exchangeQty.toFixed(4)}`);
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
    biasRatio = DIRECTION_BIAS_RATIO,
  ): void {
    const totalLevels = gridLines.length;

    switch (direction) {
      case 'long':
        // long 方向：100% buy（顺势做多，DCA 式建仓）
        for (const line of gridLines) {
          line.side = 'buy';
        }
        break;

      case 'short':
        // short 方向：100% sell（顺势做空，DCA 式建仓）
        for (const line of gridLines) {
          line.side = 'sell';
        }
        break;

      case 'long_bias': {
        const targetBuy = Math.round(totalLevels * biasRatio);
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
        const targetSell = Math.round(totalLevels * biasRatio);
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

  /** 重新初始化网格层级（每次重建都重算宽度，不继承旧边界） */
  private async reinitializeGridLevels(state: GridState, centerPrice: number): Promise<void> {
    const gridCount = state.gridLines.length;
    // 两套公式取最小值：波动小时 ATR 更窄→成交频繁；波动大时默认公式封顶→防范围过宽
    const defaultHalfRange = centerPrice * 0.03 * (gridCount / 10);
    let halfRange = defaultHalfRange;
    if (this.indicators && this.marketData) {
      try {
        const ohlcvRaw = await this.marketData.fetchOHLCV(state.symbol, '4h', 20);
        const highs  = ohlcvRaw.map((c: any) => Number(c[2]));
        const lows   = ohlcvRaw.map((c: any) => Number(c[3]));
        const closes = ohlcvRaw.map((c: any) => Number(c[4]));
        const atr    = this.indicators.calculateATR(highs, lows, closes, 14);
        if (atr && atr > 0) {
          const atrHalfRange = atr * DEFAULT_ATR_MULTIPLIER * (gridCount / 10);
          halfRange = Math.min(atrHalfRange, defaultHalfRange);
          this.logger.log(
            `[网格] 重建范围: ATR半幅=${atrHalfRange.toFixed(4)}, 默认半幅=${defaultHalfRange.toFixed(4)}, 取小值=${halfRange.toFixed(4)}`,
          );
        }
      } catch (_e) {
        this.logger.log(`[网格] 重建范围(ATR获取失败，用默认公式): halfRange=${halfRange.toFixed(4)}`);
      }
    }

    state.upperPrice = centerPrice + halfRange;
    state.lowerPrice = centerPrice - halfRange;
    state.gridSpacing = (state.upperPrice - state.lowerPrice) / (gridCount - 1);

    // 重建前先保存所有 filled 层信息，重建后映射到最近价格层
    const filledPositions = state.gridLines
      .filter(l => l.state === 'filled')
      .map(l => ({
        positionEntry: l.positionEntry,
        positionSize: l.positionSize,
        unrealizedPnl: l.unrealizedPnl,
        side: l.side,
        orderId: l.orderId,
        orderQuantity: l.orderQuantity,
      }));

    const weights = this.calculateWeights(gridCount, state.distribution);
    const weightSum = weights.reduce((a, b) => a + b, 0);

    for (let i = 0; i < gridCount; i++) {
      const line = state.gridLines[i];
      line.price = Math.round((state.lowerPrice + i * state.gridSpacing) * 100) / 100;
      line.allocatedUSD = state.totalInvestment * (weights[i] / weightSum);
      // 全部重置（filled 层后续由最近价格映射恢复）
      line.state = 'empty';
      line.orderId = undefined;
      line.orderQuantity = 0;
      line.positionSize = 0;
      line.positionEntry = 0;
      line.unrealizedPnl = 0;
    }

    this.applyGridDirection(state.gridLines, centerPrice, state.currentDirection);
    state.orderBook = {};

    // 恢复 filled 层到价格最近的新层
    for (const saved of filledPositions) {
      let closestIdx = -1;
      let closestDist = Infinity;
      for (let i = 0; i < state.gridLines.length; i++) {
        const dist = Math.abs(state.gridLines[i].price - saved.positionEntry);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }
      if (closestIdx >= 0 && state.gridLines[closestIdx].state !== 'filled') {
        const line = state.gridLines[closestIdx];
        line.state = 'filled';
        line.positionEntry = saved.positionEntry;
        line.positionSize = saved.positionSize;
        line.unrealizedPnl = saved.unrealizedPnl;
        line.side = saved.side;
        line.orderId = saved.orderId;
        line.orderQuantity = saved.orderQuantity;
        this.logger.log(
          `[网格] 重建后恢复 filled 层: index=${closestIdx}, price=${line.price.toFixed(4)}, entry=${saved.positionEntry.toFixed(4)}`,
        );
      }
    }

    this.logger.log(`[网格] 重建网格: 范围 ${state.lowerPrice.toFixed(2)}-${state.upperPrice.toFixed(2)}`);
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    const ohlcv = await this.marketData.fetchOHLCV(symbol, '1m', 1);
    if (ohlcv && ohlcv.length > 0) {
      return Number(ohlcv[ohlcv.length - 1][4]);
    }
    throw new Error(`无法获取 ${symbol} 当前价格`);
  }

  // ========================= 突破检测 =========================

  /** 检测价格是否突破网格边界 */
  private checkBreakout(
    state: GridState,
    currentPrice: number,
  ): { type: 'upper' | 'lower' | 'none'; pct: number } {
    if (currentPrice > state.upperPrice) {
      const pct = (currentPrice - state.upperPrice) / state.upperPrice * 100;
      return { type: 'upper', pct };
    }
    if (currentPrice < state.lowerPrice) {
      const pct = (state.lowerPrice - currentPrice) / state.lowerPrice * 100;
      return { type: 'lower', pct };
    }
    return { type: 'none', pct: 0 };
  }

  /**
   * 处理突破:
   *   ≥ 2% → 取消所有挂单 + 暂停策略，返回 true（主循环应立即 return）
   *   1~2% → 仅记录警告，继续运行，返回 false
   *   < 1% → 不处理，返回 false
   */
  private async handleBreakout(
    state: GridState,
    breakout: { type: 'upper' | 'lower'; pct: number },
    adapter: ExchangeAdapter,
    strategyId: string,
  ): Promise<boolean> {
    const { type, pct } = breakout;
    const direction = type === 'upper' ? '上' : '下';
    if (pct >= 2) {
      this.logger.warn(
        `[网格] 价格突破${direction}界 ${pct.toFixed(2)}% ≥ 2%，取消所有挂单并暂停`,
      );
      try {
        await adapter.cancelAllOrders(state.symbol);
        state.orderBook = {};
        for (const line of state.gridLines) {
          if (line.state === 'pending') {
            line.state = 'empty';
            line.orderId = undefined;
          }
        }
      } catch (e: any) {
        this.logger.warn(`[网格] 突破后取消挂单失败（忽略）: ${e.message}`);
      }
      state.isPaused = true;
      state.pauseSource = 'breakout';
      state.pauseReason = `价格突破${direction}界 ${pct.toFixed(2)}%，等待重新进入区间后恢复`;
      await this.persistGridState(strategyId, state);
      return true;
    } else if (pct >= 1) {
      this.logger.warn(
        `[网格] 价格突破${direction}界 ${pct.toFixed(2)}% (1-2%)，记录但继续运行`,
      );
    }
    return false;
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
        // hold/wait 不纳入摘要（actionsOnly 模式下这些条目会被过滤掉，无需展示）
        if (!['place_buy_limit', 'place_sell_limit', 'cancel_order', 'hold', 'wait'].includes(act)) {
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
        unrealizedPnl: state.lastUnrealizedPnl ?? 0,
        breakoutLevel: state.breakoutLevel,
        lastPrice: state.lastPrice,
        startEquity: state.startEquity,
        currentProfitPct: state.startEquity > 0 && state.lastEquity
          ? (state.lastEquity - state.startEquity) / state.startEquity * 100
          : 0,
        // 每层详情：供前端展示层级状态表，用户可核对交易所
        gridLines: state.gridLines.map((l, i) => {
          const entry: Record<string, unknown> = {
            lv: i + 1,
            p: +l.price.toFixed(4),
            s: l.side,
            st: l.state,
          };
          if (l.state === 'filled') {
            entry.qty = +(l.positionSize ?? 0).toFixed(4);
            entry.ep = +(l.positionEntry ?? l.price).toFixed(4);
          } else if (l.state === 'pending') {
            entry.oid = l.orderId?.slice(-8) ?? '';  // 仅保留末8位，节省存储
          }
          return entry;
        }),
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

  /** 清除内存状态，强制下次从 DB 加载并 reconcile（用于 startStrategy） */
  clearGridState(strategyId: string): void {
    this.gridStates.delete(strategyId);
  }

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
