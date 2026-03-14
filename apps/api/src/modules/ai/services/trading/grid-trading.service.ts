import { Injectable, Logger, Optional, BadRequestException, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
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
  leverage?: number | null;    // 杠杆倍数：null/undefined = AI 决策(≤5x)，填值 = 固定杠杆
  distribution?: 'uniform' | 'gaussian' | 'pyramid'; // 分布（默认 uniform）
  direction?: GridDirection;   // 方向（默认 neutral）
  useATRBounds?: boolean;      // 使用 ATR 自动边界
  atrMultiplier?: number;      // ATR 乘数（默认 2.0）
  maxDrawdownPct?: number;     // 最大回撤%（默认 15）
  dailyLossLimitPct?: number;  // 日内亏损限额%（默认 5）
  breakoutPct?: number;        // 价格突破网格边界暂停阈值%（默认 2）
  enableDirectionAdjust?: boolean; // 启用方向自适应（突破时自动偏转方向，默认 false 对齐 nofx；nofx 无此功能）
  directionBiasRatio?: number;     // 偏向比例（默认 0.7，即 70% 偏向 / 30% 反向）
  useMakerOnly?: boolean;      // PostOnly 限价单
  modelId?: string;            // AI 模型（默认 deepseek-chat）
  directionalCloseOnBreakout?: boolean; // 突破上界时平 short、突破下界时平 long（默认 false，对齐 nofx：突破时只 cancel+pause）
  takerFeeRate?: number;    // 交易所 Taker 手续费率（默认 DEFAULT_TAKER_FEE_RATE）
  makerFeeRate?: number;    // 交易所 Maker 手续费率（默认 DEFAULT_MAKER_FEE_RATE）
  stopLossPct?: number;          // 单格止损阈值%（默认 5）：价格偏离 ≥ 此值平掉该格
  profitTargetPct?: number;      // 策略止盈目标%（0=AI自主决策，>0=传递给AI提示词）
  autoAdjustThreshold?: number;  // 网格重建阈值（小数，默认 0.2 = 20%）：严重倾斜+价格偏离超此值时自动重建
  autoPauseOnTrend?: boolean;   // 检测到趋势市场自动软暂停（默认 true）
  locale?: string;              // 用户语言（用于日志翻译，如 'zh-CN', 'en'）
  boundsFromPct?: boolean;      // true = 上下界由前端百分比换算，AI 可重建范围（当前仅此一种情况）
  upperBoundPct?: number;       // 上界百分比（如 1.5 表示当前价 ×1.015），adjust_grid 时按此重算
  lowerBoundPct?: number;       // 下界百分比（如 1.5 表示当前价 ×0.985），adjust_grid 时按此重算
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
  gridCount: number; // 网格层数，持久化用（gridLines 不再存 DB，重建时需要此字段）
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

  // 手续费率（从 GridConfig 复制，供 syncOrderFills 使用）
  takerFeeRate: number;
  makerFeeRate: number;

  // 燃油费结算（点卡扣费基准）
  chargedProfit: number;    // 已结算扣费的利润累计，防止重复扣费

  // 策略权益追踪
  startEquity: number;      // 策略启动时的账户权益，永不变更（用于计算策略总收益率）
  lastEquity: number;       // 最近一次成功获取的账户权益（用于计算总盈亏）
  lastUnrealizedPnl: number; // 最近一次从交易所持仓获取的未实现盈亏（buildGridContext 每轮更新）

  // 动态杠杆（对齐 nofx：configLeverage 用于下单，recommendedLeverage 仅展示）
  effectiveLeverage: number;  // 已废弃，始终等于 leverage（兼容旧数据引用）
  userFixedLeverage: boolean; // true = 用户固定杠杆；false = AI 决策
  recommendedLeverage?: number; // min(leverage, regimeCap)，仅展示用（对齐 nofx）

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
  // 策略止盈目标%（从 GridConfig 复制，0=未设置/AI自主决策）
  profitTargetPct: number;
  // 用户设定的边界百分比（从 GridConfig 复制），adjust_grid 时用来重算绝对价格
  upperBoundPct?: number;  // 上界 = 当前价 × (1 + upperBoundPct/100)
  lowerBoundPct?: number;  // 下界 = 当前价 × (1 - lowerBoundPct/100)

  // === 信号驱动自动调节字段（Round 1+2，每 cycle 重算，重启后首轮为 0）===
  lastVolume24h: number;      // 最近 24h 成交量（updateBoxData 更新）
  avgDailyVolume: number;     // 近 72h 日均成交量（updateBoxData 更新）
  lastAtrHourly: number;      // ATR(14)[5m]（classifyRegime 返回后存储，仅存不读）
  lastAtrSpikeRatio: number;  // 当前ATR/基线ATR比率（updateBoxData 计算）
  // === 信号驱动自动调节字段（Phase 12，每 cycle 重算，重启后首轮为 0）===
  rsiDivergenceType: 'bullish' | 'bearish' | 'none'; // RSI 背离类型（updateBoxData 计算）
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
// 手续费与 cancel_all 守卫常量
const DEFAULT_TAKER_FEE_RATE = 0.0005;      // 0.05% — Binance/OKX 默认 Taker 费率
const DEFAULT_MAKER_FEE_RATE = 0.0002;      // 0.02% — Binance/OKX 默认 Maker 费率
const MIN_GRID_PROFIT_MULTIPLIER = 1.5;     // 网格间距必须 ≥ 手续费来回 × 1.5 才有盈利空间
// cancel_all 安全阀已移除（对齐 nofx：无偏离度限制，AI 发出即执行）
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

  // 容器重启后首轮恢复追踪：Set 在进程生命周期内持续，容器重启时自动清空
  // 确保每次容器重启后首轮必定执行 exchange 恢复，不受 getGridState 预加载影响
  private readonly reconcileCompleted = new Set<string>();

  // neutral side 一次性修正追踪：容器重启后首个有 currentPrice 的轮次执行一次
  // nofx: side 在 initializeGridLevels 用 currentPrice 一次性赋值，之后静态不变
  // HOOT buildGridLinesFromConfig 用 centerPrice（静态中间价），重启后需用实时价修正空层 side
  private readonly neutralSideCorrected = new Set<string>();

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
      leverage: leverageInput,
      distribution = 'uniform',
      direction = 'neutral',
      useATRBounds = false,
      atrMultiplier = DEFAULT_ATR_MULTIPLIER,
    } = config;

    // 杠杆模式：null/undefined/0 = AI 动态决策（跟随市场状态）；填值 = 固定杠杆
    const AI_DYNAMIC_LEVERAGE_DEFAULT = 4; // AI 决策模式初始值，运行时由 REGIME_LEVERAGE_CAP 每轮覆盖
    const userFixedLeverage = leverageInput != null && leverageInput > 0;
    const leverage: number = userFixedLeverage ? leverageInput! : AI_DYNAMIC_LEVERAGE_DEFAULT;

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
      gridCount: gridLines.length,
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

      takerFeeRate: config.takerFeeRate ?? DEFAULT_TAKER_FEE_RATE,
      makerFeeRate: config.makerFeeRate ?? DEFAULT_MAKER_FEE_RATE,

      chargedProfit: 0,

      startEquity: initialEquity,
      lastEquity: initialEquity,
      lastUnrealizedPnl: 0, // 首轮 buildGridContext 后从交易所持仓更新
      effectiveLeverage: leverage, // 初始 = 用户配置值，运行时由 regime 压低
      userFixedLeverage,           // true = 固定杠杆，跳过 Regime 压杆
      // 所有边界均来自百分比换算，AI 始终可调整范围（无固定价格锁定场景）
      userLockedRange: false,
      rangeSource,  // 持久化供前端展示: '用户指定' | 'ATR×5.0' | '±3.0%兜底' 等
      availableBalance: 0, // 初始为 0，首轮 buildGridContext 后从交易所更新
      stopLossPct: config.stopLossPct ?? DEFAULT_STOP_LOSS_PCT,
      profitTargetPct: config.profitTargetPct ?? 0,
      upperBoundPct: config.upperBoundPct,
      lowerBoundPct: config.lowerBoundPct,
      // 信号驱动字段：首轮为 0，第二轮起正常计算
      lastVolume24h: 0,
      avgDailyVolume: 0,
      lastAtrHourly: 0,
      lastAtrSpikeRatio: 0,
      rsiDivergenceType: 'none' as const,
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
        // 兼容旧数据：profitTargetPct 不存在时 fallback 到 0（AI自主决策）
        state.profitTargetPct ??= 0;
        // 兼容旧数据：信号字段（Phase 11/12 新增，旧 DB 记录无此字段）
        state.lastVolume24h ??= 0;
        state.avgDailyVolume ??= 0;
        state.lastAtrHourly ??= 0;
        state.lastAtrSpikeRatio ??= 0;
        (state as any).rsiDivergenceType ??= 'none';
      }
    }

    // Step 1.1: 容器重启恢复（首轮执行一次）
    // reconcileCompleted 在进程生命周期内持续，容器重启时自动清空
    // 使用 Set 而非 if (!state) 判断，避免 getGridState 预加载导致恢复块被跳过
    if (state && !this.reconcileCompleted.has(strategyId)) {
      // 容器重启恢复：对齐 nofx——全部 empty，只恢复挂单 pending，持仓由 AI 第一轮通过 positionLong/positionShort 自行决策
      this.logger.log(`[网格] 容器重启恢复: 全部重置 → 从交易所恢复挂单`);
      this.resetGridLayers(state);
      await this.recoverOrdersFromExchange(state, userId, apiKeyId);
      this.reconcileCompleted.add(strategyId);
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
      // nofx 对齐：风控重启 = 全空层 + 取消所有挂单，持仓由 AI 自行决策
      this.resetGridLayers(state);
      await this.cancelAllGridOrders(state, userId, apiKeyId);
    }

    // Step 1.3: 暂停恢复后干净重启（resume_grid / breakout 自动恢复触发）
    // nofx 对齐：全空层 + 取消所有挂单，让 AI 在下轮从干净状态重建
    if (state && !state.isPaused && state.needsReconcile) {
      state.needsReconcile = false;
      this.logger.log(`[网格] 暂停恢复: 全空层 + 取消所有挂单（干净重启）`);
      this.resetGridLayers(state);
      await this.cancelAllGridOrders(state, userId, apiKeyId);
    }

    // Step 1.5: 配置变更检测 — 原地取消挂单 + 重建层级（历史利润不清零）
    if (state && state.isInitialized && gridConfig) {
      const configChanged = this.detectGridConfigChange(state, gridConfig);
      if (configChanged) {
        this.logger.warn(
          `[网格] 检测到配置变更: ${configChanged}，原地重建（历史利润保留）`,
        );
        // 取消前先保存每层挂单qty均值（用于重建后持仓恢复layerCount估算）
        // cleanupExistingOrders 会取消所有挂单，之后 pending 层为空，无法从挂单推算
        const preRebuildPendingQty = (() => {
          const lines = state.gridLines.filter(l => l.state === 'pending' && l.orderQuantity > 0.0001);
          return lines.length > 0 ? lines.reduce((s, l) => s + l.orderQuantity, 0) / lines.length : 0;
        })();
        // Step A: 取消交易所所有挂单 + 清空内存层状态（避免 filledSnapshots 与交易所持仓双重映射）
        await this.cleanupExistingOrders(state, userId, apiKeyId);
        this.resetGridLayers(state);
        // Step B: 原地更新 state 配置字段
        if (gridConfig.symbol) state.symbol = gridConfig.symbol;
        if (gridConfig.leverage !== undefined) {
          // null/0 = AI 动态决策（跟随市场状态）；正数 = 固定杠杆
          const AI_DYNAMIC_LEVERAGE_DEFAULT = 4;
          const newUserFixed = gridConfig.leverage != null && gridConfig.leverage > 0;
          state.leverage = newUserFixed ? gridConfig.leverage! : AI_DYNAMIC_LEVERAGE_DEFAULT;
          state.userFixedLeverage = newUserFixed;
          // AI 决策模式下 Step 6.5 会每轮根据 regime 重算 leverage
          state.effectiveLeverage = state.leverage;
        }
        if (gridConfig.totalInvestment) state.totalInvestment = gridConfig.totalInvestment;
        if (gridConfig.direction) state.currentDirection = gridConfig.direction;
        if (gridConfig.distribution) state.distribution = gridConfig.distribution;
        // 同步百分比边界（用户在前端修改了百分比时立即生效）
        state.upperBoundPct = gridConfig.upperBoundPct;
        state.lowerBoundPct = gridConfig.lowerBoundPct;
        // Step C: 层数变更时调整 gridLines 数组大小
        const newCount = gridConfig.gridCount ?? state.gridLines.length;
        if (newCount !== state.gridLines.length) {
          if (newCount > state.gridLines.length) {
            for (let i = state.gridLines.length; i < newCount; i++) {
              state.gridLines.push({
                index: i, price: 0, state: 'empty', side: 'buy',
                orderId: undefined, orderQuantity: 0, positionSize: 0,
                positionEntry: 0, allocatedUSD: 0, unrealizedPnl: 0,
              });
            }
          } else {
            state.gridLines = state.gridLines.slice(0, newCount);
          }
          state.gridLines.forEach((l, i) => { l.index = i; });
        }
        // Step D: 获取价格并原地重建层级
        let rebuildPrice: number;
        try {
          rebuildPrice = await this.getCurrentPrice(state.symbol);
        } catch (e: any) {
          this.logger.error(`[网格] 配置变更时获取价格失败: ${e.message}，跳过本轮`);
          return { trades: 0, errors: 1 };
        }
        // 若用户设定了百分比边界，按百分比重建；否则 ATR 自动计算
        if (state.upperBoundPct && state.lowerBoundPct) {
          const explicitUpper = rebuildPrice * (1 + state.upperBoundPct / 100);
          const explicitLower = rebuildPrice * (1 - state.lowerBoundPct / 100);
          this.logger.log(
            `[网格] 配置变更: 按用户百分比重建 +${state.upperBoundPct}%/-${state.lowerBoundPct}%` +
            ` → [${explicitLower.toFixed(2)}, ${explicitUpper.toFixed(2)}]`,
          );
          await this.reinitializeGridLevels(state, rebuildPrice, explicitUpper, explicitLower);
        } else {
          await this.reinitializeGridLevels(state, rebuildPrice);
        }
        // reinitializeGridLevels 已从内存保存 filled 层并恢复（对齐 nofx autoAdjustGrid）
        state.needsReconcile = false;
        await this.persistGridState(strategyId, state);
        this.logger.log(
          `[网格] 配置变更重建完成: ${newCount} 层，利润保留 ${state.totalProfit >= 0 ? '+' : ''}${state.totalProfit.toFixed(2)} USDT`,
        );
        // 写入策略日志，让用户在前端能看到网格重建事件
        const rebuildRangePct = ((state.upperPrice - state.lowerPrice) / rebuildPrice * 100).toFixed(1);
        await this.prisma.aiStrategyLog.create({
          data: {
            strategyId,
            symbol: state.symbol,
            decision: {
              action: 'grid_rebuild',
              gridSummary: `重建/${configChanged}`,
              reasoning: `检测到配置变更: ${configChanged}，原地重建（历史利润保留）` +
                `\n新范围: $${state.lowerPrice.toFixed(2)} ~ $${state.upperPrice.toFixed(2)} (${rebuildRangePct}%)` +
                `\n间距: $${state.gridSpacing.toFixed(4)}, ${newCount} 层` +
                `\n当前价: $${rebuildPrice.toFixed(4)}` +
                `\n累计利润: ${state.totalProfit >= 0 ? '+' : ''}${state.totalProfit.toFixed(2)} USDT (保留)`,
              gridSnapshot: {
                upperPrice: state.upperPrice,
                lowerPrice: state.lowerPrice,
                gridSpacing: state.gridSpacing,
                direction: state.currentDirection,
                totalLevels: newCount,
                totalInvestment: state.totalInvestment,
                leverage: state.leverage,
                lastPrice: rebuildPrice,
                totalProfit: state.totalProfit,
                totalTrades: state.totalTrades,
                gridLines: state.gridLines.map((l) => ({
                  lv: l.index + 1,
                  p: l.price,
                  s: l.side,
                  st: l.state,
                })),
              },
            } as any,
            executed: true,
          },
        }).catch((e) => {
          this.logger.warn(`[网格] 配置变更日志写入失败: ${e.message}`);
        });
        // 无需 reconcile — exchange 已由 cleanupExistingOrders 清空，本轮继续正常流程
        this.reconcileCompleted.add(strategyId);  // 重建已完成恢复，跳过 Step 1.1
      }
    }

    if (!state || !state.isInitialized) {
      // 首次初始化（非配置变更路径）
      if (gridConfig) {
        state = await this.initializeGrid(strategyId, userId, apiKeyId, gridConfig, apiKeys);
        // nofx 对齐：新建网格 = 全空层，取消所有旧挂单，持仓由 AI 自行决策
        await this.cancelAllGridOrders(state, userId, apiKeyId);
        this.reconcileCompleted.add(strategyId);  // 初始化已完成恢复，跳过 Step 1.1
      } else {
        this.logger.warn(`[网格] 策略 ${strategyId} 未初始化`);
        return { trades: 0, errors: 0 };
      }
    }

    // 所有边界均来自百分比换算，无固定价格锁定场景，始终保持 false
    if (state.userLockedRange !== false) {
      state.userLockedRange = false;
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

    // 一次性 neutral side 修正（容器重启后首个有 currentPrice 的轮次执行）
    // nofx: initializeGridLevels 用当时 currentPrice 一次性赋值 side，之后静态不变
    // HOOT buildGridLinesFromConfig 用 centerPrice（上下界中间价），与实时价不同，需修正
    // 仅对 empty 层修正；pending/filled 层 side 不变（由交易所挂单/持仓方向决定）
    if (!this.neutralSideCorrected.has(strategyId)) {
      this.neutralSideCorrected.add(strategyId);
      if ((state.currentDirection ?? 'neutral') === 'neutral') {
        let corrected = 0;
        for (const line of state.gridLines) {
          if (line.state === 'empty') {
            const correctSide = line.price <= currentPrice ? 'buy' : 'sell';
            if (line.side !== correctSide) {
              line.side = correctSide;
              corrected++;
            }
          }
        }
        if (corrected > 0) {
          this.logger.log(
            `[网格] 一次性 neutral side 修正: ${corrected} 层（基于实时价 ${currentPrice}）`,
          );
        }
      }
    }

    // ──── 风控优先：Step 3/3.5/4 始终在突破检查(Step 2)前执行，确保即使突破 return 风控也已生效 ────
    let earlyAdapter: ExchangeAdapter | null = null;

    // Step 3: 最大回撤检查（预取余额+持仓，计算 livePositionNotional 供 cap 检查用）
    let currentEquity = state.peakEquity;
    let equityFetched = false;      // 只有真实获取权益成功才设为 true，失败时不更新 dailyPnl
    let livePositions: any[] | undefined; // 持仓快照，仅用于 livePositionNotional 计算
    if (this.adapterFactory && apiKeyId) {
      try {
        earlyAdapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
        const balance = await earlyAdapter.getBalance();
        currentEquity = balance.totalEquity;
        equityFetched = true;        // 成功才设为 true
        state.lastEquity = currentEquity; // 记录最新权益用于总盈亏计算
        livePositions = await earlyAdapter.getPositions(); // 预取持仓，计算 livePositionNotional
        // 用交易所真实持仓名义价值，取代内存 filled 层（避免幽灵持仓虚高）
        {
          const baseSymbol = state.symbol.split('/')[0];
          state.livePositionNotional = livePositions.reduce((sum: number, pos: any) => {
            if ((pos as any).symbol?.includes(baseSymbol)) {
              const qty = Math.abs((pos as any).quantity ?? 0);
              const px = (pos as any).markPrice ?? (pos as any).entryPrice ?? currentPrice ?? 0;
              return sum + qty * px;
            }
            return sum;
          }, 0);
        }
        this.logger.debug(`[网格] Step3: livePositions.len=${livePositions.length}, livePositionNotional=${state.livePositionNotional.toFixed(4)}`);
      } catch (e: any) {
        this.logger.warn(`[网格] Step3 权益获取失败，使用缓存值 (peakEquity=${state.peakEquity}): ${e.message}`);
      }
    }

    if (currentEquity > state.peakEquity) {
      state.peakEquity = currentEquity;
    }

    // ★ 日内 P&L 跟踪 — 权益获取成功后立即更新，不受后续 return 影响
    // 放在这里确保 Step 4 的提前 return 也能正确保存日内基准
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

    // earlyAdapter 只用于 getBalance + getPositions，用完立即释放
    // 止损检查+执行对齐 nofx: 在 syncOrderFills 之后内联执行（见 L1362）
    if (earlyAdapter) {
      try { await earlyAdapter.dispose(); } catch {}
      earlyAdapter = null;
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

    // Step 2: 简单边界突破检查（已暂停时跳过，让 AI 受限模式接管，避免持仓无人管理持续亏损）
    if (!state.isPaused) {
      const breakoutPct = this.checkSimpleBreakout(currentPrice, state);
      const breakoutThreshold = gridConfig?.breakoutPct ?? DEFAULT_BREAKOUT_PCT;
      if (breakoutPct >= breakoutThreshold) {
        const direction = currentPrice > state.upperPrice ? 'up' : 'down';
        this.logger.warn(`[网格] 价格突破网格边界 ${breakoutPct.toFixed(1)}% ≥ ${breakoutThreshold}%（${direction}），撤单+暂停网格`);

        // 方向性平仓（默认关闭，对齐 nofx：突破时只 cancel+pause，不主动平仓）
        if (gridConfig?.directionalCloseOnBreakout === true) {
          await this.directionalCloseOnBreakout(state, direction, userId, apiKeyId);
        }

        // 对齐 nofx：暂停时必须撤销所有挂单（防止价格继续偏离时挂单成交造成亏损）
        const pauseReason = `价格突破网格边界 ${breakoutPct.toFixed(1)}% (${direction})`;
        await this.softPauseGrid(state, userId, apiKeyId, pauseReason, 'breakout');
        await this.persistGridState(strategyId, state);
        return { trades: 0, errors: 0 };
      }
    }

    // Step 5: 箱体数据更新（Donchian，供 AI 判断突破；突破决策由 AI 自行决定是否 pause_grid）
    if (this.indicators) {
      try {
        await this.updateBoxData(state);
      } catch (e: any) {
        this.logger.warn(`[网格] 箱体数据更新失败: ${e.message}`);
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

    // Step 6.5: 动态杠杆
    // - 用户固定杠杆 → leverage 不变，recommendedLeverage 仅展示
    // - AI 决策模式 → leverage 每轮跟随 REGIME_LEVERAGE_CAP 动态调整
    state.userFixedLeverage ??= true;
    const regimeCap = REGIME_LEVERAGE_CAP[state.currentRegime] ?? state.leverage;
    if (!state.userFixedLeverage) {
      // AI 决策模式：实际杠杆 = 市场状态对应的上限值
      const prevLev = state.leverage;
      state.leverage = regimeCap;
      state.recommendedLeverage = regimeCap;
      if (prevLev !== regimeCap) {
        this.logger.log(`[网格] AI动态杠杆: ${prevLev}x → ${regimeCap}x (${state.currentRegime})`);
      }
    } else {
      // 用户固定杠杆：recommendedLeverage 仅展示
      state.recommendedLeverage = Math.min(state.leverage, regimeCap);
    }
    state.effectiveLeverage = state.leverage;

    // Step 6.6: 箱体突破方向自适应 — 在 Step 8 adapter 块内执行（需要 adapter 取消挂单）

    // Step 7: 暂停检查
    if (state.isPaused) {
      if (state.pauseSource === 'risk_control') {
        // 风控暂停不可自动恢复，直接跳过
        this.logger.warn(`[网格] ${state.symbol} 风控暂停，跳过: ${state.pauseReason || ''}`);
        await this.persistGridState(strategyId, state);
        return { trades: 0, errors: 0 };
      }
      // breakout/ai/trend 暂停 → AI 受限模式运行，评估是否需要重建网格
      this.logger.warn(`[网格] ${state.symbol} [${state.pauseSource ?? '未知'}]暂停，AI受限模式评估重建`);
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

        // AI 决策模式：每轮同步杠杆到交易所（杠杆可能因市场状态变化）
        if (!state.userFixedLeverage) {
          try {
            await adapter.setLeverage(state.symbol, state.leverage);
          } catch (e: any) {
            // -4161 = 有持仓时无法降杠杆（正常，warn 不影响流程）
            this.logger.warn(`[网格] AI动态杠杆 setLeverage(${state.leverage}x) 失败: ${e.message}`);
          }
        }

        // 每轮清理僵尸止损单（不再主动放交易所止损单，此处为防残留）
        if (isGridAdapter(adapter)) {
          try {
            await (adapter as GridExchangeAdapter).cancelStopOrders(state.symbol);
          } catch (e: any) {
            this.logger.warn(`[网格] 清理止损单失败(忽略): ${e.message}`);
          }
        }


        // 突破检测：暂停中先尝试 checkFalseBreakoutRecovery 自动恢复；非暂停时执行正常检测
        if (state.isPaused) {
          // 尝试自动恢复（价格可能已回归箱体或网格区间）
          // 对齐 nofx：方向自适应默认关闭（nofx 无此功能）
          const enableDirAdj = gridConfig?.enableDirectionAdjust ?? false;
          this.checkFalseBreakoutRecovery(state, currentPrice, enableDirAdj);
          if (!state.isPaused) {
            this.logger.log(`[网格] 价格回归，暂停自动解除，继续正常运行`);
          }
          // 仍暂停 → AI 受限模式继续，不再执行突破检测（避免重复设置 isPaused）
        } else {
          // 非暂停：正常执行边界突破检测
          if (state.upperPrice > 0 && state.lowerPrice > 0) {
            const breakout = this.checkBreakout(state, currentPrice);
            if (breakout.type !== 'none') {
              const paused = await this.handleBreakout(
                state, breakout as { type: 'upper' | 'lower'; pct: number }, adapter, strategyId,
              );
              if (paused) return { trades, errors };
            }
          }

          // Step 6.6: 箱体突破检测 → 方向自适应
          // enableDirectionAdjust=true 时：短/中期突破→方向偏转，长期突破→紧急平仓
          // enableDirectionAdjust=false 时：短期→reduce_position，中期→pause，长期→close_all
          if (state.shortBoxUpper > 0) {
            const boxDetected = this.detectBoxBreakout(currentPrice, state);
            if (boxDetected.level !== 'none') {
              const confirmed = this.confirmBreakout(state, boxDetected.level, boxDetected.direction);
              if (confirmed) {
                // 对齐 nofx：方向自适应默认关闭，short→reduce_position，mid→pause，long→close_all
                const enableDirAdj = gridConfig?.enableDirectionAdjust ?? false;
                const action = this.getBreakoutAction(boxDetected.level, enableDirAdj);
                await this.executeBreakoutAction(
                  state, action, boxDetected.direction, userId, apiKeyId, adapter,
                );
                if (state.isPaused) {
                  await this.persistGridState(strategyId, state);
                  return { trades, errors };
                }
              }
            } else {
              this.confirmBreakout(state, 'none', ''); // 重置连续计数
            }
            const enableDirAdj = gridConfig?.enableDirectionAdjust ?? false;
            this.checkFalseBreakoutRecovery(state, currentPrice, enableDirAdj);
          }
        }

        // 杠杆只在初始化时设一次，运行时不动态调整（对齐 nofx）

        // Pre-sync: 在构建 AI 上下文前先同步交易所状态到内存
        // 解决数据源不一致问题：context.levels / AI分析 / header stats / 层级显示 必须统一
        // 历史教训 2026-03-13：旧版 sync 只在周期末 → AI 看到的数据比交易所落后1周期
        // → AI 分析说"5层空头"但实际8层、层级显示5 filled但header显示8
        // 同时捕获交易所数据用于层级显示（显示 AI 决策前的状态，而非执行后的状态）
        let preSyncExchangeOrders: any[] = [];
        let preSyncExchangePositions: any[] = [];
        if (isGridAdapter(adapter)) {
          const preSyncResult = await this.syncOrderFills(state, adapter as GridExchangeAdapter, userId);
          preSyncExchangeOrders = preSyncResult.exchangeOpenOrders ?? [];
          preSyncExchangePositions = preSyncResult.exchangePositions ?? [];
          if (preSyncResult.filledLines.length > 0) {
            trades += preSyncResult.filledLines.length;
            this.logger.log(`[网格] 前置同步: ${preSyncResult.filledLines.length} 笔新成交检测`);
          }
        }

        // 构建 AI 上下文
        // 传入 pre-sync 交易所数据，确保 AI 看到的 levels 和 UI 层级显示完全一致
        const context = await this.buildGridContext(
          state, adapter, currentPrice, gridConfig?.enableDirectionAdjust ?? false,
          preSyncExchangeOrders, preSyncExchangePositions,
        );

        // 全局网格倾斜计算（从交易所数据统计，和 AI/UI 一致）
        const preSyncDisplay = this.buildDisplayFromExchange(state, preSyncExchangeOrders, preSyncExchangePositions);
        const { skewed: _skewed, buyFilled: skewBuy, sellFilled: skewSell } = this.checkGridSkew(state, preSyncDisplay);
        const skewTotal = skewBuy + skewSell;
        let skewLevel: 'none' | 'light' | 'severe' = 'none';
        if (skewTotal >= 3) {
          const heavy = Math.max(skewBuy, skewSell);
          const light = Math.min(skewBuy, skewSell);
          if ((light === 0 && heavy >= 3) || (light > 0 && heavy >= 3 * light)) skewLevel = 'severe';
          else if (heavy >= 2 * light) skewLevel = 'light';
        }
        (context as any).gridSkewLevel = skewLevel;
        (context as any).gridSkewBuyFilled = skewBuy;
        (context as any).gridSkewSellFilled = skewSell;
        (context as any).autoAdjustThreshold = gridConfig?.autoAdjustThreshold ?? 0.2;
        if (skewLevel !== 'none') {
          this.logger.warn(`[网格] 全局倾斜: ${skewLevel} buy=${skewBuy} sell=${skewSell}`);
        }


        const modelId = gridConfig?.modelId || 'deepseek-chat';

        const response = await this.llm.chat(
          modelId,
          GRID_SYSTEM_PROMPT(state.symbol, state.gridLines.length, state.totalInvestment, state.leverage, state.distribution, currentPrice, gridConfig?.locale),
          buildGridUserPrompt({ ...context, locale: gridConfig?.locale }),
          apiKeys,
          { temperature: 0.3, maxTokens: 2000 },
        );

        // LLM 调用期间（30-40s）DrawdownMonitor 可能已 dispose 同一缓存 adapter
        // 重新检查，若已失效则重建，确保后续执行循环正常
        if (!adapter.isReady()) {
          this.logger.warn(`[网格] LLM 调用后 adapter 已失效，重新获取`);
          adapter = await this.adapterFactory!.createAdapter(userId, apiKeyId);
        }

        // LLM 调用期间用户可能已风控停止策略
        if ((state.isPaused && state.pauseSource === 'risk_control') || !this.gridStates.has(strategyId)) {
          this.logger.warn(`[网格] LLM 调用后策略已风控停止，跳过本轮决策执行`);
          return { trades, errors };
        }

        // 解析 AI 决策（新格式：{analysis, actions}，兼容旧格式 [...]）
        const { decisions, analysis: marketAnalysis } = this.parseGridDecisions(response.content);

        // confidence 过滤：跳过低置信度 AI 决策（对齐 3月9日稳定版）
        const CONFIDENCE_THRESHOLD = 40;
        const confFiltered = decisions.filter(d => {
          if (d.confidence === undefined) return true; // 未提供 confidence 的决策默认通过（兼容旧格式）
          if (d.confidence >= CONFIDENCE_THRESHOLD) return true;
          this.logger.warn(`[网格] 低置信决策跳过: action=${this.actionLabel(d.action, gridConfig?.locale)} confidence=${d.confidence} reasoning=${d.reasoning}`);
          return false;
        });

        // 暂停受限模式：只允许 adjust_grid / close_long / close_short / hold
        const PAUSE_ALLOWED_ACTIONS = new Set(['adjust_grid', 'close_long', 'close_short', 'hold']);
        const execDecisions = (state.isPaused && state.pauseSource !== 'risk_control')
          ? confFiltered.filter(d => {
              if (PAUSE_ALLOWED_ACTIONS.has(d.action)) return true;
              this.logger.warn(`[网格] 暂停受限模式：跳过非允许动作 ${d.action}`);
              return false;
            })
          : confFiltered;

        // 执行决策（收集每条执行结果，供日志记录）
        // 层级显示统一用 preSyncDisplay（buildDisplayFromExchange 构建，交易所实时数据）
        // 见下方 saveGridDecisionLog 调用处的 displayGridLines
        const execResults: Array<{ action: string; level?: number; success: boolean; skipped?: boolean; skipReason?: string; error?: string }> = [];
        // 把交易所实时层级挂到 state，供 placeGridLimitOrder 的 filled 检查使用（交易所是唯一事实）
        (state as any)._exchangeDisplay = preSyncDisplay;
        let accountConfigError: string | null = null; // OKX 51010 等账户配置错误（需用户手动修复）
        // 若决策列表包含 pause_grid，跳过所有 place_* 操作（否则下单后立即被撤，浪费 API 调用）
        const hasPauseGrid = execDecisions.some(d => d.action === 'pause_grid');
        for (const d of execDecisions) {
          // 每条决策执行前检查策略是否已被停止
          if ((state.isPaused && state.pauseSource === 'risk_control') || !this.gridStates.has(strategyId)) {
            const remaining = execDecisions.length - execDecisions.indexOf(d);
            this.logger.warn(`[网格] 策略已风控停止，跳过剩余 ${remaining} 个决策`);
            break;
          }
          // 若本轮含 pause_grid，跳过所有 place_* 操作（避免下单后立即被 cancelAllOrders 撤掉，浪费 API 调用）
          if (hasPauseGrid && d.action.startsWith('place_')) {
            execResults.push({ action: d.action, level: d.level, success: true, skipped: true, skipReason: '本轮含 pause_grid，跳过下单' });
            continue;
          }
          // 账户配置错误已确认（如 OKX 51010）→ 跳过后续下单，避免刷屏重试
          if (accountConfigError) {
            execResults.push({ action: d.action, level: d.level, success: false, error: accountConfigError });
            errors++;
            continue;
          }
          try {
            const result = await this.executeGridDecision(state, d, adapter, userId, apiKeyId, gridConfig?.useMakerOnly ?? true, currentPrice, gridConfig?.locale);
            if (result.executed && d.action.includes('place_')) trades++;
            if (!result.executed && d.action.startsWith('place_')) {
              // place_* 被系统限制拦截（仓位上限/最小数量/价差过宽等）→ 视为失败
              // 前端 !log.executed + errors 面板会显示具体原因
              execResults.push({ action: d.action, level: d.level, success: false, error: result.skipReason });
              errors++;
            } else {
              execResults.push({ action: d.action, level: d.level, success: true, skipped: !result.executed, skipReason: result.skipReason });
            }
          } catch (e: any) {
            errors++;
            const errCategory = classifyExchangeError(e);
            const rawCode = e?.code ?? e?.id ?? '';
            this.logger.warn(`[网格] 执行决策失败: ${this.actionLabel(d.action, gridConfig?.locale)} [${errCategory}${rawCode ? '/' + rawCode : ''}] - ${e.message}`);
            const errEntry = `[${errCategory}${rawCode ? '/' + rawCode : ''}] ${e.message}`;
            execResults.push({ action: d.action, level: d.level, success: false, error: errEntry });
            // 账户配置错误（如 OKX 51010）是持久性错误，后续订单无需再试
            if (errCategory === '账户配置错误') {
              accountConfigError = errEntry;
              this.logger.error(`[网格] 账户配置错误（如 OKX 未开通合约交易），本轮停止下单: ${e.message}`);
            }
          }
        }

        // syncOrderFills 在 AI 执行之后（周期末）
        // 检测本轮 AI 执行后的新成交，更新格线状态供下轮决策使用
        let postSyncExchangeOrders: any[] = [];
        let postSyncExchangePositions: any[] = [];
        if (isGridAdapter(adapter)) {
          const syncResult = await this.syncOrderFills(state, adapter as GridExchangeAdapter, userId);
          postSyncExchangeOrders = syncResult.exchangeOpenOrders ?? [];
          postSyncExchangePositions = syncResult.exchangePositions ?? [];
          if (syncResult.filledLines.length > 0) {
            trades += syncResult.filledLines.length;
            this.logger.log(`[网格] 成交同步: ${syncResult.filledLines.length} 笔新成交 | 累计 +${state.totalProfit.toFixed(2)} USDT`);
          }
        }

        // 对齐 nofx: checkAndExecuteStopLoss 在 syncGridState(syncOrderFills) 之后内联执行
        // nofx 中止损检查和执行在同一位置（AI 决策之后），HOOT 之前是 AI 前标记+AI 后执行，现统一为 AI 后
        if (isGridAdapter(adapter) && currentPrice > 0) {
          const perLevelStopPct = state.stopLossPct > 0 ? state.stopLossPct : DEFAULT_STOP_LOSS_PCT;
          for (let idx = 0; idx < state.gridLines.length; idx++) {
            const line = state.gridLines[idx];
            if (line.state !== 'filled' || !line.positionEntry || line.positionEntry <= 0) continue;
            const lossPct = line.side === 'sell'
              ? ((currentPrice - line.positionEntry) / line.positionEntry) * 100
              : ((line.positionEntry - currentPrice) / line.positionEntry) * 100;
            if (lossPct < perLevelStopPct) continue;
            this.logger.warn(
              `[网格] 硬止损触发: 层${idx + 1} ${line.side} entry=${line.positionEntry.toFixed(4)} ` +
              `亏损=${lossPct.toFixed(1)}% ≥ ${perLevelStopPct}%`,
            );
            const closeSide = line.side === 'buy' ? 'long' : 'short';
            const closeQty = line.positionSize || 0;
            if (closeQty > 0) {
              try {
                if (closeSide === 'long') {
                  await (adapter as GridExchangeAdapter).closeLong(state.symbol, closeQty);
                } else {
                  await (adapter as GridExchangeAdapter).closeShort(state.symbol, closeQty);
                }
                const entryPx = line.positionEntry || 0;
                const profit = closeSide === 'long'
                  ? (currentPrice - entryPx) * closeQty
                  : (entryPx - currentPrice) * closeQty;
                state.totalProfit += profit;
                state.dailyTotalProfit = (state.dailyTotalProfit ?? 0) + profit; // 对齐 nofx: DailyPnL += realizedLoss
                state.totalTrades++;  // 对齐 nofx: TotalTrades++
                this.logger.warn(
                  `[网格] 硬止损平仓: 层${idx + 1} ${closeSide} qty=${closeQty} profit=${profit.toFixed(4)}`,
                );
                line.state = 'stopped';
                line.positionSize = 0;
                line.positionEntry = 0;
                line.orderId = undefined;
                state.livePositionNotional = Math.max(0, state.livePositionNotional - closeQty * currentPrice);
              } catch (e: any) {
                this.logger.error(`[网格] 硬止损层${idx + 1}失败: ${e.message}`);
              }
            }
          }
        }

        // 构建 postSyncDisplay（从交易所数据，不读内存）
        // 用于 autoAdjustGrid 倾斜检测 + 层级摘要日志
        const postSyncDisplay = this.buildDisplayFromExchange(state, postSyncExchangeOrders, postSyncExchangePositions);

        // 对齐 nofx: autoAdjustGrid 在 checkAndExecuteStopLoss 之后（syncGridState 末尾）
        if (isGridAdapter(adapter)) {
          await this.autoAdjustGrid(
            state,
            adapter as GridExchangeAdapter,
            currentPrice,
            gridConfig?.autoAdjustThreshold ?? 0.2,
            strategyId,
            userId,
            apiKeyId,
            postSyncDisplay,  // 从交易所数据检测倾斜
          );
        }

        // 层级状态摘要日志（从交易所数据构建，不读内存）
        {
          const filled  = postSyncDisplay.filter((d: any) => d.st === 'filled');
          const pending = postSyncDisplay.filter((d: any) => d.st === 'pending');
          const empty   = postSyncDisplay.filter((d: any) => d.st === 'empty' || !d.st);
          const filledStr  = filled.map((d: any) =>
            `L${d.lv}(${d.s})@${(d.ep ?? d.p).toFixed(2)}×${(d.qty ?? 0).toFixed(3)}`
          ).join(' ');
          const pendingStr = pending.map((d: any) => `L${d.lv}@${d.p.toFixed(2)}`).join(' ');
          const emptyStr   = empty.map((d: any) => `L${d.lv}`).join(',');
          this.logger.log(
            `[网格] 层级 | 持仓: ${filledStr || '无'} | 挂单: ${pendingStr || '无'} | 空格: [${emptyStr || '无'}]`,
          );
        }

        // 记录到 AiStrategyLog（含 GridState 快照和执行结果）
        // 每轮都写入，无操作轮次由前端归类为"X 次分析无操作（已隐藏）"
        // 层级显示用 preSyncDisplay（AI 决策前算好的快照），不能重新调 buildDisplayFromExchange
        // 因为 state.gridLines 在 AI 执行后已被修改（新 pending/filled），重算会导致层级状态与 AI 分析不一致
        {
          const hasIssues = execResults.some(r => !r.success || r.skipped);
          await this.saveGridDecisionLog(
            strategyId, state.symbol, decisions, response.cost, state, response.thinking,
            hasIssues ? execResults : undefined, marketAnalysis, preSyncDisplay, gridConfig?.locale,
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

    return state.breakoutConfirmCount >= BREAKOUT_CONFIRM_REQUIRED;
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

  /** 价格回归后方向逐步恢复中性 */
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
    adapter?: ExchangeAdapter | null,
  ): Promise<void> {
    this.logger.warn(`[网格] 突破动作: ${action}, 方向=${direction}, 级别=${state.breakoutLevel}`);

    switch (action) {
      case 'reduce_position':
        state.positionReductionPct = 50;
        break;

      case 'adjust_direction': {
        // 取消挂单 + 重新分配层级方向
        const newDirection = this.determineGridDirection(
          state.breakoutLevel as BreakoutLevel,
          direction as 'up' | 'down',
        );
        if (newDirection !== state.currentDirection) {
          this.logger.log(
            `[网格] 方向自适应: ${state.currentDirection} → ${newDirection}` +
            ` (${state.breakoutLevel} 级别突破 ${direction})`,
          );
          // 取消现有挂单，防止方向切换后原挂单方向错误
          if (adapter) {
            try { await adapter.cancelAllOrders(state.symbol); } catch (e: any) {
              this.logger.warn(`[网格] 方向切换取消挂单失败(忽略): ${e.message}`);
            }
          }
          // 清理内存中的 pending 订单状态
          for (const line of state.gridLines) {
            if (line.state === 'pending') { line.state = 'empty'; line.orderId = undefined; }
          }
          state.orderBook = {};
          state.currentDirection = newDirection;
          this.applyGridDirection(
            state.gridLines,
            state.lastPrice || 0,
            newDirection as GridDirection,
          );
        }
        break;
      }

      case 'pause_grid':
        // 对齐 nofx PauseGrid：取消所有挂单 + 暂停（持仓保留不动）
        if (adapter) {
          try {
            await adapter.cancelAllOrders(state.symbol);
            for (const line of state.gridLines) {
              if (line.state === 'pending') { line.state = 'empty'; line.orderId = undefined; }
            }
            state.orderBook = {};
          } catch (e: any) {
            this.logger.warn(`[网格] pause_grid 取消挂单失败(忽略): ${e.message}`);
          }
        }
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
  private checkFalseBreakoutRecovery(state: GridState, price: number, enableDirectionAdjust = false): void {
    const needsReset = state.isPaused || state.positionReductionPct > 0;
    if (!needsReset) return;

    let recovered = false;

    // 优先：价格回到长期箱体内（Donchian）
    if (
      state.longBoxUpper > 0 && state.longBoxLower > 0 &&
      price >= state.longBoxLower && price <= state.longBoxUpper
    ) {
      recovered = true;
      this.logger.log('[网格] 虚假突破恢复: 价格回到长期箱体内');
    }
    // 兜底：无箱体数据时，价格回到网格区间内也恢复（对齐 nofx 静默跳过时的意图）
    else if (
      state.longBoxUpper === 0 &&
      state.lowerPrice > 0 && state.upperPrice > 0 &&
      price >= state.lowerPrice && price <= state.upperPrice
    ) {
      recovered = true;
      this.logger.log('[网格] 虚假突破恢复（兜底）: 无箱体数据，价格回到网格区间内');
    }

    if (recovered) {
      state.breakoutLevel = 'none';
      state.breakoutDirection = '';
      state.breakoutConfirmCount = 0;
      // 价格回归后部分恢复（50%），AI 负责逐步补仓
      state.positionReductionPct = 50;
      // 只释放突破类暂停，风控类暂停（pauseSource=risk_control）不能被恢复函数解除
      if (state.pauseSource !== 'risk_control') {
        state.isPaused = false;
        state.pauseReason = undefined;
        state.pauseSource = undefined;
        state.needsReconcile = true;
      }
    }

    // 价格回到短期箱体内时，方向逐步向中性恢复（仅 enableDirectionAdjust=true）
    if (
      enableDirectionAdjust &&
      state.currentDirection !== 'neutral' &&
      state.shortBoxUpper > 0 && state.shortBoxLower > 0 &&
      price >= state.shortBoxLower && price <= state.shortBoxUpper
    ) {
      const recoveredDirection = this.determineRecoveryDirection(state.currentDirection);
      if (recoveredDirection !== state.currentDirection) {
        this.logger.log(
          `[网格] 方向逐步恢复: ${state.currentDirection} → ${recoveredDirection}` +
          ` (价格回到短期箱体 ${state.shortBoxLower.toFixed(2)}~${state.shortBoxUpper.toFixed(2)})`,
        );
        state.currentDirection = recoveredDirection;
        this.applyGridDirection(
          state.gridLines,
          price,
          recoveredDirection as GridDirection,
        );
        state.needsReconcile = true;
      }
    }
  }

  // ========================= 市场状态分类 =========================

  /** 分类市场状态（基于 5m K线 BB/ATR，与 AI 收到的指标同源） */
  private async classifyRegime(symbol: string): Promise<{ regime: RegimeLevel; atrHourly: number }> {
    // 对齐 nofx: 使用 5m K线，与 AI 收到的 BB/ATR 指标同源（避免 1h 和 5m 数据矛盾）
    const ohlcvRaw = await this.marketData.fetchOHLCV(symbol, '5m', 50);
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
    else if (bbWidth <= 6.0 && atrPct <= 3.0) regime = 'wide';   // 扩大 wide 上限至 BB≤6%（3月9日稳定版，SOL/BTC 正常波动区间）
    else regime = 'volatile'; // BB>6% 或 ATR>3%（真正极端高波动）

    return { regime, atrHourly: atr ?? 0 };
  }

  // ========================= AI 上下文 & 决策 =========================

  /**
   * 从内存 gridLines 直接读取层级状态（nofx 对齐：ctx.Levels = gridState.Levels）
   *
   * nofx 设计：buildGridContext 不做任何 exchange→层 重映射，直接读内存。
   * 内存由两条路径维护：
   *   - 启动/重建时：recoverOrdersFromExchange + recoverPositionsFromExchange（一次性）
   *   - 运行时：placeGridLimitOrder（→ pending）+ syncOrderFills（→ filled/empty）
   */
  private buildExchangeLevels(
    gridLines: GridLine[],
    currentPrice: number,
    leverage: number,
  ): GridContext['levels'] {
    return gridLines.map((l) => {
      const normalQty = l.allocatedUSD > 0 && currentPrice > 0
        ? (l.allocatedUSD * leverage) / currentPrice
        : 0;

      if (l.state === 'pending' && l.orderId) {
        return {
          price: l.price,
          side: l.side as 'buy' | 'sell',
          quantity: normalQty,
          positionSize: 0,
          state: 'pending' as const,
          orderId: l.orderId,
          fillPrice: undefined,
          profit: undefined,
        };
      }

      if (l.state === 'filled' && l.positionSize > 0.0001) {
        const profit = l.side === 'buy'
          ? (currentPrice - l.positionEntry) * l.positionSize
          : (l.positionEntry - currentPrice) * l.positionSize;
        // positionEntry = 交易所真实入场价（交易所是唯一真相）
        const displayPrice = l.positionEntry > 0 ? l.positionEntry : l.price;
        return {
          price: displayPrice,
          side: l.side as 'buy' | 'sell',
          quantity: normalQty,
          positionSize: l.positionSize,
          state: 'filled' as const,
          orderId: undefined,
          fillPrice: l.positionEntry > 0 ? l.positionEntry : undefined,
          profit,
        };
      }

      return {
        price: l.price,
        side: l.side as 'buy' | 'sell',
        quantity: normalQty,
        positionSize: 0,
        state: 'cancelled' as const,
        orderId: undefined,
        fillPrice: undefined,
        profit: undefined,
      };
    });
  }

  /** 构建网格 AI 上下文 */
  private async buildGridContext(
    state: GridState,
    adapter: ExchangeAdapter,
    currentPrice: number,
    enableDirectionAdjust = false,
    preSyncExchangeOrders?: any[],
    preSyncExchangePositions?: any[],
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
      // 始终 fresh 获取余额
      const balance = await adapter.getBalance();
      totalEquity = balance.totalEquity;
      availableBalance = balance.availableBalance;
      state.availableBalance = availableBalance; // 同步到 state，供 AI 上下文展示
      unrealizedPnl = balance.unrealizedPnl;
      state.lastUnrealizedPnl = unrealizedPnl; // 同步到 state，供 saveGridDecisionLog 使用
      marginUsedPct = balance.marginUsedPct ?? 0;

      // 始终 fresh 获取持仓
      const positions = await adapter.getPositions();
      const baseSymbol = state.symbol.split('/')[0];
      const symPositions = positions.filter((p: any) => p.symbol.includes(baseSymbol));
      const longPos = symPositions.find((p: any) => p.side === 'long' || p.side === 'net' || !p.side);
      const shortPos = symPositions.find((p: any) => p.side === 'short');

      // 净持仓
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

      // 交易所是唯一真相：每轮用交易所真实入场价刷新内存中 filled 层的 positionEntry
      // 消除内存旧值与交易所实时数据的矛盾（重建/重启后内存可能残留错误入场价）
      for (const line of state.gridLines) {
        if (line.state !== 'filled' || (line.positionSize ?? 0) <= 0.0001) continue;
        if (line.side === 'buy' && longPos && (longPos.entryPrice ?? 0) > 0) {
          line.positionEntry = longPos.entryPrice!;
        } else if (line.side === 'sell' && shortPos && (shortPos.entryPrice ?? 0) > 0) {
          line.positionEntry = shortPos.entryPrice!;
        }
      }
    } catch { /* 使用默认值 */ }

    // 资金费率
    let fundingRate = 0;
    try {
      const fr = await this.marketData.fetchFundingRate(state.symbol);
      if (fr) fundingRate = fr.fundingRate;
    } catch { /* 忽略 */ }

    // 并行拉取：委托单状态 + 近期历史成交（24h内，最多10笔）
    let exchangeOpenOrders: GridContext['exchangeOpenOrders'];
    let recentClosedPnl: GridContext['recentClosedPnl'];
    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [rawOpenOrders, rawClosedPnl] = await Promise.all([
        adapter.getOpenOrders(state.symbol).catch((e: any) => {
        this.logger.warn(`[网格] buildGridContext getOpenOrders失败: ${e.message}`);
        return [];
      }),
        adapter.getClosedPnl(since24h, 10).catch(() => []),
      ]);
      exchangeOpenOrders = rawOpenOrders.map(o => ({
        orderId: o.orderId,
        side: o.side,
        price: o.price ?? 0,
        quantity: o.quantity,
      }));
      recentClosedPnl = rawClosedPnl.map(r => ({
        symbol: r.symbol,
        side: r.side,
        quantity: r.quantity,
        entryPrice: r.entryPrice,
        exitPrice: r.exitPrice,
        realizedPnl: r.realizedPnl,
        closedAt: r.exitTime instanceof Date ? r.exitTime.toISOString() : String(r.exitTime),
      }));
    } catch { /* 忽略，不阻塞主流程 */ }

    // ── 对齐 nofx: 每轮从交易所实时数据重建 state.gridLines ──
    // state.gridLines 由 syncOrderFills（周期末增量更新）维护；启动时 resetGridLayers 全空，recoverOrdersFromExchange 恢复挂单
    // 禁止在 buildGridContext 内做持仓对账（见 .claude/rules/网格数据架构原则.md）

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

    // 层级状态：优先从交易所数据构建（和 UI 显示完全一致）
    // 有 pre-sync 交易所数据时用 buildDisplayFromExchange，否则 fallback 到内存
    let exchangeLevels: GridContext['levels'];
    if (preSyncExchangeOrders && preSyncExchangePositions) {
      // 从交易所数据构建（和 UI buildDisplayFromExchange 完全相同的数据源）
      const displayLines = this.buildDisplayFromExchange(state, preSyncExchangeOrders, preSyncExchangePositions);
      exchangeLevels = displayLines.map((d: any, i: number) => {
        const gl = state.gridLines[i];
        const normalQty = gl?.allocatedUSD > 0 && currentPrice > 0
          ? (gl.allocatedUSD * (state.leverage ?? 1)) / currentPrice
          : 0;
        if (d.st === 'pending') {
          return {
            price: d.p, side: d.s as 'buy' | 'sell', quantity: normalQty,
            positionSize: 0, state: 'pending' as const, orderId: d.oid,
            fillPrice: undefined, profit: undefined,
          };
        }
        if (d.st === 'filled') {
          const ep = d.ep ?? d.p;
          const profit = d.s === 'buy'
            ? (currentPrice - ep) * (d.qty ?? 0)
            : (ep - currentPrice) * (d.qty ?? 0);
          return {
            price: ep, side: d.s as 'buy' | 'sell', quantity: normalQty,
            positionSize: d.qty ?? 0, state: 'filled' as const, orderId: undefined,
            fillPrice: ep, profit,
          };
        }
        return {
          price: d.p, side: d.s as 'buy' | 'sell', quantity: normalQty,
          positionSize: 0, state: 'cancelled' as const, orderId: undefined,
          fillPrice: undefined, profit: undefined,
        };
      });
    } else {
      // Fallback：交易所数据不可用时，返回全空层（不用内存脏数据喂 AI）
      // AI 看到全空层会选择 hold，等下一轮交易所恢复
      this.logger.warn(`[网格] buildGridContext: 交易所数据不可用，返回全空层（不使用内存）`);
      exchangeLevels = state.gridLines.map((gl) => ({
        price: gl.price,
        side: gl.side as 'buy' | 'sell',
        quantity: gl.allocatedUSD > 0 && currentPrice > 0
          ? (gl.allocatedUSD * (state.leverage ?? 1)) / currentPrice
          : 0,
        positionSize: 0,
        state: 'cancelled' as const,
        orderId: undefined,
        fillPrice: undefined,
        profit: undefined,
      }));
    }

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
      levels: exchangeLevels,
      activeOrderCount: exchangeLevels.filter((l) => l.state === 'pending').length,
      filledLevelCount: exchangeLevels.filter((l) => l.state === 'filled' && (l.positionSize ?? 0) > 0).length,
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
      enableDirectionAdjust,
      startEquity: state.startEquity,
      currentProfitPct: state.startEquity > 0 ? (totalEquity - state.startEquity) / state.startEquity * 100 : 0,
      marginUsedPct,
      oiChange1h: 0,
      rsiDivergenceType: state.rsiDivergenceType,  // RSI 背离信号（Phase 12）
      // K线历史（最近30根1h蜡烛，供AI判断趋势/支撑阻力）
      ohlcv: ohlcvHourly.slice(-30).map(c => ({
        open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
      })),
      userLockedRange: state.userLockedRange ?? false,
      stopLossPct: state.stopLossPct > 0 ? state.stopLossPct : undefined,
      profitTargetPct: state.profitTargetPct > 0 ? state.profitTargetPct : undefined,
      currentRegime: state.currentRegime,  // 后端检测的市场形态，与 UI 显示一致

      exchangeOpenOrders,
      recentClosedPnl,
      positionReductionPct: state.positionReductionPct > 0 ? state.positionReductionPct : undefined,
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
      if (!jsonStr) return { decisions: [{ action: 'hold', reasoning: 'AI 未返回有效 JSON' } as GridDecision] };

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
        if (decisions.length === 0) return { decisions: [{ action: 'hold', reasoning: 'AI 返回空操作列表' } as GridDecision], analysis };
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
        if (decisions.length === 0) return { decisions: [{ action: 'hold', reasoning: 'AI 返回空操作列表' } as GridDecision] };
        return { decisions };
      }

      return { decisions: [{ action: 'hold', reasoning: 'AI 响应格式无法识别' } as GridDecision] };
    } catch (e: any) {
      this.logger.warn(`[网格] AI 决策解析失败: ${e.message}`);
      return { decisions: [{ action: 'hold', reasoning: `AI 响应解析失败: ${e.message}` } as GridDecision] };
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
          // 执行前回填层号/价格/数量到 decision，供日志展示（与 place_* 保持一致）
          const preCancelIdx = state.orderBook[cancelOrderId];
          if (preCancelIdx !== undefined && state.gridLines[preCancelIdx]) {
            const cancelLine = state.gridLines[preCancelIdx];
            decision.level = preCancelIdx + 1; // 1-based，与 AI prompt 层号一致
            decision.price = cancelLine.price;
            decision.quantity = cancelLine.orderQuantity || undefined;
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
        // 对齐 nofx：无偏离度安全阀，AI 发出 cancel_all 时直接执行
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
        const pendingBeforeCancel = state.gridLines.filter(l => l.state === 'pending').length;
        await adapter.cancelAllOrders(state.symbol);
        this.logger.log(`[网格] adjust_grid 撤单: ${pendingBeforeCancel} 个pending挂单已全部撤销`);
        const newPrice = currentPrice ?? state.lastPrice;
        const oldLower = state.lowerPrice?.toFixed(2) ?? '?';
        const oldUpper = state.upperPrice?.toFixed(2) ?? '?';
        const priceVsRange = state.upperPrice && newPrice > state.upperPrice
          ? `超出上界 ${oldUpper}`
          : state.lowerPrice && newPrice < state.lowerPrice
            ? `跌破下界 ${oldLower}`
            : 'AI 主动重建';
        this.logger.log(
          `[网格] 重建触发: 当前价 ${newPrice.toFixed(2)} ${priceVsRange}（旧范围 ${oldLower}~${oldUpper}）`,
        );
        // 用户设定了百分比边界：按百分比重算当前价的上/下界
        // 未设定（AI 模式）：ATR 自动计算
        if (state.upperBoundPct && state.lowerBoundPct) {
          const explicitUpper = newPrice * (1 + state.upperBoundPct / 100);
          const explicitLower = newPrice * (1 - state.lowerBoundPct / 100);
          const totalSpanPct = ((explicitUpper - explicitLower) / newPrice * 100).toFixed(1);
          const gridCountLog = state.gridLines.length;
          const spacingLog = ((explicitUpper - explicitLower) / (gridCountLog - 1)).toFixed(2);
          this.logger.log(
            `[网格] adjust_grid: 按用户百分比重建 +${state.upperBoundPct}%/-${state.lowerBoundPct}%` +
            ` → [${explicitLower.toFixed(2)}, ${explicitUpper.toFixed(2)}]` +
            `\n       以当前价 ${newPrice.toFixed(2)} 为中心，上扩 +${state.upperBoundPct}% → ${explicitUpper.toFixed(2)}，下扩 -${state.lowerBoundPct}% → ${explicitLower.toFixed(2)}，共 ${gridCountLog} 层，格间距 ${spacingLog}，总跨度 ${totalSpanPct}%`,
          );
          await this.reinitializeGridLevels(state, newPrice, explicitUpper, explicitLower);
        } else {
          await this.reinitializeGridLevels(state, newPrice);
        }
        // reinitializeGridLevels 已从内存保存 filled 层并恢复（对齐 nofx autoAdjustGrid）
        // 重建后自动解除暂停（breakout/ai/trend 暂停均可通过重建恢复）
        if (state.isPaused && state.pauseSource !== 'risk_control') {
          state.isPaused = false;
          state.pauseSource = undefined;
          state.pauseReason = undefined;
          this.logger.log(`[网格] adjust_grid 重建完成，自动解除暂停`);
        }
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
        // 回填平仓价到 decision，前端日志可展示（AI 可能只发 level+quantity）
        const closeLongPrice = currentPrice ?? state.lastPrice;
        if (!decision.price) decision.price = closeLongPrice;
        // 防御：若 AI 对 filled sell 层发出 close_long，自动转 closeShort（sell层=空头持仓）
        let closeLongResult: any;
        if (targetLevel?.side === 'sell') {
          this.logger.warn(`[网格] close_long 目标层${targetLevel.index}为sell层（空头），自动转 closeShort`);
          closeLongResult = await (adapter as GridExchangeAdapter).closeShort(state.symbol, qty);
        } else {
          closeLongResult = await (adapter as GridExchangeAdapter).closeLong(state.symbol, qty);
        }
        if (targetLevel && targetLevel.positionSize > 0) {
          // 优先使用 CCXT 实际成交价，其次用 currentPrice
          const actualClosePrice = closeLongResult?.avgPrice || currentPrice || state.lastPrice;
          const _cp = new Decimal(actualClosePrice);
          const _ep = new Decimal(targetLevel.positionEntry);
          const _sz = new Decimal(targetLevel.positionSize);
          const _fr = new Decimal(state.takerFeeRate);
          // 优先使用交易所返回的 realizedPnl（最准确），否则本地计算
          const exchangePnl = closeLongResult?.realizedPnl;
          const netProfitD = exchangePnl != null
            ? new Decimal(exchangePnl)
            : _cp.minus(_ep).times(_sz)
              .minus(_cp.times(_sz).times(_fr))
              .minus(_ep.times(_sz).times(_fr));
          const netProfit = netProfitD.toNumber();
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
          const closedValue = qty * _cp.toNumber();
          state.livePositionNotional = Math.max(0, (state.livePositionNotional ?? 0) - closedValue);
          this.logger.log(`[网格] close_long 平仓: level=${targetLevel.index}, ccxtPrice=${_cp.toFixed(4)}, profit=${netProfit >= 0 ? '+' : ''}${netProfitD.toFixed(8)} USDT${exchangePnl != null ? ' (exchange)' : ' (calc)'}`);
          this.saveClosedPositionRecord(
            userId,
            state.strategyId,
            (adapter as any).exchangeType ?? 'unknown',
            state.symbol,
            'long',
            _ep.toNumber(),
            _cp.toNumber(),
            _sz.toNumber(),
            state.leverage ?? 1,
            netProfit,
            'ai_close',
          );
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
        // 回填平仓价到 decision，前端日志可展示
        const closeShortPrice = currentPrice ?? state.lastPrice;
        if (!decision.price) decision.price = closeShortPrice;
        // 防御：若 AI 对 filled buy 层发出 close_short，自动转 closeLong（buy层=多头持仓）
        let closeShortResult: any;
        if (targetLevel?.side === 'buy') {
          this.logger.warn(`[网格] close_short 目标层${targetLevel.index}为buy层（多头），自动转 closeLong`);
          closeShortResult = await (adapter as GridExchangeAdapter).closeLong(state.symbol, qty);
        } else {
          closeShortResult = await (adapter as GridExchangeAdapter).closeShort(state.symbol, qty);
        }
        // 无论是否有 targetLevel，都更新 livePositionNotional（孤儿空头平仓）
        const actualClosePriceShort = closeShortResult?.avgPrice || currentPrice || state.lastPrice;
        const closedValueShort = qty * actualClosePriceShort;
        state.livePositionNotional = Math.max(0, (state.livePositionNotional ?? 0) - closedValueShort);
        if (targetLevel && targetLevel.positionSize > 0) {
          // 优先使用 CCXT 实际成交价
          const _cp2 = new Decimal(actualClosePriceShort);
          const _ep2 = new Decimal(targetLevel.positionEntry);
          const _sz2 = new Decimal(targetLevel.positionSize);
          const _fr2 = new Decimal(state.takerFeeRate);
          // 优先使用交易所返回的 realizedPnl
          const exchangePnl2 = closeShortResult?.realizedPnl;
          const netProfitD2 = exchangePnl2 != null
            ? new Decimal(exchangePnl2)
            : _ep2.minus(_cp2).times(_sz2)
              .minus(_cp2.times(_sz2).times(_fr2))
              .minus(_ep2.times(_sz2).times(_fr2));
          const netProfit = netProfitD2.toNumber();
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
          this.logger.log(`[网格] close_short 平仓: level=${targetLevel.index}, ccxtPrice=${_cp2.toFixed(4)}, profit=${netProfit >= 0 ? '+' : ''}${netProfitD2.toFixed(8)} USDT${exchangePnl2 != null ? ' (exchange)' : ' (calc)'}`);
          this.saveClosedPositionRecord(
            userId,
            state.strategyId,
            (adapter as any).exchangeType ?? 'unknown',
            state.symbol,
            'short',
            _ep2.toNumber(),
            _cp2.toNumber(),
            _sz2.toNumber(),
            state.leverage ?? 1,
            netProfit,
            'ai_close',
          );
        } else {
          this.logger.warn(`[网格] close_short 孤儿空头平仓: qty=${qty}, 无对应 grid level`);
        }
        return { executed: true };
      }

      case 'hold':
        // hold 时打印 reasoning，便于终端日志追踪 AI 决策理由
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

    // 对齐 nofx: placeGridLimitOrder 无 filled 层拦截
    // AI 负责决策是否在 filled 层下单（如：在 filled buy 层挂 sell 以锁利润）

    // 防重复下单 — 如果该层已有 pending 挂单，先取消旧单再下新单
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

    // 后端唯一约束：价格有效性（PERCENT_PRICE）+ 仓位上限
    const finalLevelIndex = levelIndex;
    const finalLevel = level;

    // 始终优先使用 AI 建议价格，格线预设价作为 fallback
    const price = (decision.price && decision.price > 0)
      ? decision.price
      : (finalLevel?.price ?? 0);

    if (price <= 0 || quantity <= 0) {
      const skipReason = `无效参数: price=${price}, quantity=${quantity}`;
      this.logger.warn(`[网格] 跳过下单: ${skipReason} (level=${levelIndex})`);
      return { executed: false, skipReason };
    }

    // Step 1: per-level 仓位上限检查（始终用静态配置杠杆，与 nofx 一致）
    const leverage = state.leverage;
    let capTruncated = false;
    let capUsed = 0;
    let capTotal = 0;
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

      // 总仓位上限：已成交持仓 + 挂单名义价值（与 nofx checkTotalPositionLimit 一致）
      const totalPositionCap = state.totalInvestment * leverage;
      const livePositionNotional = state.livePositionNotional ?? 0;
      const pendingNotional = state.gridLines
        .filter(l => l.state === 'pending' && (l.orderQuantity ?? 0) > 0)
        .reduce((sum, l) => sum + (l.orderQuantity ?? 0) * l.price, 0);
      capTotal = totalPositionCap;
      capUsed = livePositionNotional + pendingNotional;
      if (capUsed + quantity * price > totalPositionCap) {
        // 削减至剩余可用额度（持仓+挂单）
        const remaining = Math.max(0, totalPositionCap - livePositionNotional - pendingNotional);
        quantity = Math.min(quantity, remaining / price);
        capTruncated = true;
        if (quantity <= 0) {
          const skipReason = `总仓位已满: 持仓+挂单 $${(livePositionNotional + pendingNotional).toFixed(2)} / 上限 $${totalPositionCap.toFixed(2)}`;
          this.logger.warn(`[网格] ${skipReason} | investment=${state.totalInvestment} leverage=${leverage} level=${levelIndex}`);
          return { executed: false, skipReason };
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
      let skipReason: string;
      if (capTruncated) {
        // 总仓位额度不足导致 qty 被截断
        skipReason =
          `总仓位额度不足: 已用 $${capUsed.toFixed(2)} / 上限 $${capTotal.toFixed(2)}，` +
          `剩余 $${(capTotal - capUsed).toFixed(2)} 不够 ${coinSymbol} 最低 $${MIN_NOTIONAL.toFixed(0)}`;
      } else {
        // 真正的每层预算不足
        const perLevelNotional = (state.totalInvestment / state.gridLines.length) * leverage;
        const recommendedLevels = Math.floor((state.totalInvestment * leverage) / MIN_NOTIONAL);
        const recommendedInvestment = Math.ceil((MIN_NOTIONAL * state.gridLines.length) / leverage);
        skipReason =
          `每层资金不足: 实际下单额 $${notional.toFixed(2)}（每层预算 $${perLevelNotional.toFixed(2)}），` +
          `低于 ${coinSymbol} 最低下单额 $${MIN_NOTIONAL.toFixed(0)} | ` +
          `建议: 减少层数(${state.gridLines.length}→${recommendedLevels})` +
          `或增加投资额($${state.totalInvestment}→$${recommendedInvestment})`;
      }
      this.logger.warn(
        `[网格] 跳过下单: notional $${notional.toFixed(2)} < 交易所最低 $${MIN_NOTIONAL}` +
        ` (level=${levelIndex}, qty=${finalQty}, price=${price}) | ${skipReason}`,
      );
      return { executed: false, skipReason };
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
      // nofx 对齐：层价格(grid line)保持不变，只更新订单状态
      // 教训(2026-03-14): finalLevel.price = price 导致多层塌陷到同一价格，破坏网格等距结构
      finalLevel.state = 'pending';
      finalLevel.side = side;
      // finalLevel.price 保持原始网格线价格，禁止覆盖
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
        // 确定性 uniqueOrderId：秒级时间戳 + 盈利金额 hash → 同一秒内同利润不重复扣费
        const epochSec = Math.floor(Date.now() / 1000);
        const pnlKey = actualPnl.toFixed(8).replace('.', '_');
        const uniqueOrderId = `GRID_FEE_${userId}_${state.strategyId}_${epochSec}_${pnlKey}`;
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
    userId: string,
  ): Promise<{ filledLines: GridLine[]; exchangeOpenOrders?: any[]; exchangePositions?: any[] }> {
    const filledLines: GridLine[] = [];
    let openOrders: any[] = [];
    let syncPositions: any[] = [];
    try {
      // Step 1: 获取交易所当前挂单（实时）
      openOrders = await adapter.getOpenOrders(state.symbol);
      const activeIds = new Set(openOrders.map((o) => o.orderId));

      // Step 2: 获取交易所当前持仓（实时，每轮无条件获取）
      let currentPositionSize = 0;
      let positionFetchSucceeded = false; // 标记 getPositions 是否成功（防止失败时 currentPositionSize=0 误清 filled 层）
      try {
        syncPositions = await adapter.getPositions();
        positionFetchSucceeded = true;
        const baseSymbol = state.symbol.split('/')[0];
        for (const pos of syncPositions) {
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

      // Step 3: 内存中 filled 层的预期持仓量（带符号：buy=+, sell=-）
      // 与交易所 currentPositionSize 保持同维度，便于比较和 abs 启发式判断
      const memFilledLayers = state.gridLines.filter((l) => l.state === 'filled');
      const expectedPositionSize = memFilledLayers.reduce((sum, l) => {
        const sz = l.positionSize ?? 0;
        return sum + (l.side === 'sell' ? -sz : sz);
      }, 0);

      // Step 4: 处理"消失"的 pending 层
      const disappearedLines = state.gridLines.filter(
        (line) => line.state === 'pending' && line.orderId && !activeIds.has(line.orderId),
      );

      const pendingCount = state.gridLines.filter(l => l.state === 'pending').length;
      const emptyCount = state.gridLines.filter(l => l.state === 'empty').length;
      this.logger.log(
        `[网格] syncOrderFills: 挂单=${openOrders.length}, 总层=${state.gridLines.length}(pending=${pendingCount},filled=${memFilledLayers.length},empty=${emptyCount}), 消失=${disappearedLines.length}, currentPos=${currentPositionSize.toFixed(4)}, expectedPos=${expectedPositionSize.toFixed(4)}`,
      );
      // 调试：打印所有 filled 层详情（帮助诊断 expectedPos 异常）
      if (memFilledLayers.length > 0) {
        this.logger.log(
          `[网格] syncOrderFills filled层: ${memFilledLayers.map(l => `L${(l.index??0)+1}(${l.side},sz=${(l.positionSize??0).toFixed(4)},entry=${(l.positionEntry??0).toFixed(4)},orderId=${l.orderId??'none'})`).join(', ')}`,
        );
      }

      // 用 runningExpected 在循环内累积（仅用于 getOrderStatus 失败时的 fallback 启发式）
      let runningExpected = expectedPositionSize;

      for (const line of disappearedLines) {
        const prevOrderId = line.orderId!;
        let qty = line.orderQuantity ?? 0;
        let fillPrice = line.price; // 实际成交价（默认 limit 价，getOrderStatus 成功时用 avgPrice 覆盖）

        // 精确判断：直接查询订单状态（nofx 注释："ideally we'd query order history"）
        // 避免启发式 abs 判断在多笔同时消失时的误判（成交+撤单混合场景）
        let isFilled = false;
        try {
          const orderDetail = await adapter.getOrderStatus(state.symbol, prevOrderId);
          isFilled = orderDetail.status === 'FILLED' || orderDetail.status === 'PARTIALLY_FILLED';
          if (orderDetail.filledQuantity > 0) qty = orderDetail.filledQuantity;
          if (orderDetail.avgPrice > 0) fillPrice = orderDetail.avgPrice;
          this.logger.debug(
            `[网格] 订单状态: L${(line.index ?? 0) + 1} orderId=${prevOrderId}, ` +
            `status=${orderDetail.status}, qty=${qty.toFixed(4)}, price=${fillPrice.toFixed(4)}`,
          );
        } catch (e: any) {
          // fallback: abs 启发式（nofx 方式，API 不可用时使用）
          isFilled = Math.abs(currentPositionSize) > Math.abs(runningExpected) + 0.0001;
          this.logger.warn(
            `[网格] 订单状态查询失败，abs启发式判断: L${(line.index ?? 0) + 1} orderId=${prevOrderId} ` +
            `isFilled=${isFilled}, err=${e.message}`,
          );
        }

        if (isFilled) {
          if (line.side === 'sell') {
            // 网格卖单成交 = 平多仓（take-profit）
            // 无论 Binance hedge 还是 OKX net_mode，网格卖单始终是平多仓的止盈单
            // 优先检查当前层自身是否保留了买入持仓数据（sell on filled buy layer 场景）
            // 否则搜索最近的 filled buy 层
            let buyLayer: typeof line | undefined;
            if ((line.positionSize ?? 0) > 0 && (line.positionEntry ?? 0) > 0) {
              // 当前层有保留的买入持仓数据（placeGridLimitOrder 不再清除）
              buyLayer = line;
            } else {
              buyLayer = state.gridLines
                .filter(l => l.state === 'filled' && l.side === 'buy' && (l.positionSize ?? 0) > 0)
                .sort((a, b) => Math.abs(a.price - line.price) - Math.abs(b.price - line.price))[0];
            }

            if (buyLayer) {
              const _cp = new Decimal(fillPrice);
              const _ep = new Decimal(buyLayer.positionEntry);
              const _sz = new Decimal(qty);
              const _fr = new Decimal(state.takerFeeRate);
              const netProfitD = _cp.minus(_ep).times(_sz)
                .minus(_cp.times(_sz).times(_fr))
                .minus(_ep.times(_sz).times(_fr));
              const netProfit = netProfitD.toNumber();

              state.totalProfit += netProfit;
              state.dailyTotalProfit = (state.dailyTotalProfit ?? 0) + netProfit;
              state.totalTrades++;
              if (netProfit > 0) state.winningTrades++;
              if (netProfit > 0) await this.settleGridFee(state, userId, netProfit);

              // 清空对应买入层
              const reduceQty = Math.min(qty, buyLayer.positionSize ?? 0);
              buyLayer.positionSize = (buyLayer.positionSize ?? 0) - reduceQty;
              if (buyLayer.positionSize < 0.0001) {
                buyLayer.state = 'empty';
                buyLayer.positionSize = 0;
                buyLayer.positionEntry = 0;
                buyLayer.unrealizedPnl = 0;
              }

              // 卖单层恢复 empty（止盈完成）
              line.state = 'empty';
              line.positionSize = 0;
              line.positionEntry = 0;
              line.unrealizedPnl = 0;
              filledLines.push(line);
              runningExpected -= qty; // 平仓减少预期持仓

              this.logger.log(
                `[网格] 卖单成交(平多): L${(line.index ?? 0) + 1} @ ${fillPrice.toFixed(4)}, qty=${qty.toFixed(4)}, ` +
                `profit=${netProfit >= 0 ? '+' : ''}${netProfitD.toFixed(8)} USDT, ` +
                `对应买入层L${(buyLayer.index ?? 0) + 1} entry=${(buyLayer.positionEntry || _ep.toNumber()).toFixed(4)}`,
              );

              this.saveClosedPositionRecord(
                userId,
                state.strategyId,
                (adapter as any).exchangeType ?? 'unknown',
                state.symbol,
                'long',
                _ep.toNumber(),
                _cp.toNumber(),
                _sz.toNumber(),
                state.leverage ?? 1,
                netProfit,
                'grid_tp',
              );
            } else {
              // 无匹配买入层（孤儿卖单成交）
              line.state = 'empty';
              line.positionSize = 0;
              line.positionEntry = 0;
              line.unrealizedPnl = 0;
              state.totalTrades++;
              this.logger.warn(
                `[网格] 卖单成交但无匹配买入层: L${(line.index ?? 0) + 1} @ ${fillPrice.toFixed(4)}, qty=${qty.toFixed(4)} → empty`,
              );
            }
          } else {
            // 买单成交：标记 filled，保持 side='buy'（与 nofx 完全对齐）
            // positionEntry = 交易所实际成交价（fillPrice），交易所是唯一真相
            // nofx 用 level.Price 是因为逐层成交时层价格≈实际成交价，但本质应该用真实值
            line.state = 'filled';
            line.positionEntry = fillPrice;
            line.positionSize = qty;
            line.unrealizedPnl = 0;
            state.totalTrades++;
            filledLines.push(line);
            runningExpected += qty;
            this.logger.log(
              `[网格] 买单成交: L${(line.index ?? 0) + 1}(${line.side}) @ ${fillPrice.toFixed(4)}, qty=${qty.toFixed(4)}`,
            );
          }
        } else {
          line.state = 'empty';
          line.positionSize = 0;
          line.positionEntry = 0;
          line.unrealizedPnl = 0;
          this.logger.log(`[网格] 挂单撤销/过期: L${(line.index ?? 0) + 1}@${line.price.toFixed(4)} → empty`);
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

      // Step 6: 已删除（2026-03-14）
      // 历史教训：对账逻辑每轮清空 filled 重建 → 丢失利润计算 → OKX pnl=0.00
      // 架构原则：交易所是唯一事实，内存只做 orderId→层映射索引
      // 卖单成交时已在 Step 4 内联计算利润并清空对应买入层，无需额外对账
      // 启动时由 reconcileGridState 三步法重建（全部重置→从交易所恢复），运行时无需对账

    } catch (e: any) {
      this.logger.warn(`[网格] 订单同步失败: ${e.message}`);
    }

    return { filledLines, exchangeOpenOrders: openOrders, exchangePositions: syncPositions };
  }

  // ========================= 孤儿订单清理（reinitialize 后补充执行） =========================

  /**
   * 取消 exchange 上所有不在当前 orderBook 中的挂单（孤儿）
   * 用于 reinitializeGridLevels 清空 orderBook 之后，防止旧价位挂单持续占用保证金
   */
  /**
   * nofx 对齐：全空层（不信任 DB/内存历史状态）
   * 等价于 nofx InitializeGrid 中 levels 全设为 "empty"
   */
  private resetGridLayers(state: GridState): void {
    for (const line of state.gridLines) {
      line.state = 'empty';
      line.positionSize = 0;
      line.positionEntry = 0;
      line.unrealizedPnl = 0;
      line.orderId = undefined;
      line.orderQuantity = 0;
    }
    state.orderBook = {};
  }

  /**
   * 启动时从交易所持仓恢复 filled 层（交所唯一数据源）
   * 对齐 nofx 原则：每层数量 = allocatedUSD * leverage / price（网格配置决定），不均分
   * 从最近层向外映射，总量不超过交易所实际持仓
   */
  private async recoverPositionsFromExchange(
    state: GridState,
    userId: string,
    apiKeyId: string,
    _qtyHint = 0,   // 已废弃，保留签名兼容
  ): Promise<void> {
    if (!this.adapterFactory || !apiKeyId) return;
    let adapter: ExchangeAdapter | null = null;
    try {
      adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
      const positions = await adapter.getPositions();
      const baseSymbol = state.symbol.split('/')[0];
      const symPositions = positions.filter((p: any) => p.symbol?.includes(baseSymbol));

      for (const pos of symPositions) {
        const totalQty: number = pos.quantity ?? 0;
        if (totalQty <= 0.0001) continue;
        const rawSide = pos.side as string;
        const posSide = (rawSide === 'long' || rawSide === 'net' || !rawSide) ? 'buy' : 'sell';

        // 用交易所加权均价（唯一可靠来源）
        const avgEntry = (pos.entryPrice ?? 0) > 0
          ? pos.entryPrice
          : state.gridLines[Math.floor(state.gridLines.length / 2)].price;

        const leverage = Math.max(1, state.leverage ?? 1);

        // 容器重启：交易所返回 1 个聚合持仓，按每层预算反推应占几层
        // 计算每层标准数量
        const avgAllocatedUSD = state.totalInvestment / state.gridLines.length;
        const perLayerQty = avgAllocatedUSD * leverage / avgEntry;
        // 反推层数（至少 1 层）
        const estimatedLayers = perLayerQty > 0.0001
          ? Math.max(1, Math.round(totalQty / perLayerQty))
          : 1;

        // 将持仓平均分配到 N 个最近空层
        const emptyLayers = state.gridLines
          .map((l, idx) => ({ layer: l, idx }))
          .filter(({ layer }) => layer.state === 'empty')
          .sort((a, b) => Math.abs(a.layer.price - avgEntry) - Math.abs(b.layer.price - avgEntry));

        const layersToFill = Math.min(estimatedLayers, emptyLayers.length);
        const qtyPerLayer = totalQty / layersToFill;

        for (let i = 0; i < layersToFill; i++) {
          const { layer, idx } = emptyLayers[i];
          layer.state = 'filled';
          layer.positionEntry = avgEntry;
          layer.positionSize = qtyPerLayer;
          layer.side = posSide;
          layer.orderId = undefined;
          layer.orderQuantity = 0;
          layer.unrealizedPnl = 0;
        }

        const filledIdxs = emptyLayers.slice(0, layersToFill).map(e => `L${e.idx + 1}`).join(',');
        this.logger.log(
          `[网格] 启动持仓恢复: ${posSide === 'buy' ? '多' : '空'}头 ` +
          `qty=${totalQty.toFixed(4)} avgEntry=${avgEntry.toFixed(4)} ` +
          `→ 按每层${perLayerQty.toFixed(4)}反推${estimatedLayers}层 ` +
          `→ 映射到[${filledIdxs}]（每层${qtyPerLayer.toFixed(4)}）`,
        );
      }
    } catch (e: any) {
      this.logger.warn(`[网格] 启动持仓恢复失败（忽略）: ${e.message}`);
    } finally {
      if (adapter) { try { await adapter.dispose(); } catch { /* ignore */ } }
    }
  }

  /**
   * 容器重启恢复：从交易所挂单恢复 pending 层（不取消订单）
   * 网格数据架构原则 Step 2：exchange open orders → pending layers
   * 只在容器冷启动路径调用（不取消，只映射）
   */
  private async recoverOrdersFromExchange(
    state: GridState,
    userId: string,
    apiKeyId: string,
  ): Promise<void> {
    if (!this.adapterFactory || !apiKeyId) return;
    let adapter: ExchangeAdapter | null = null;
    try {
      adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
      const openOrders = await adapter.getOpenOrders(state.symbol);
      const baseSymbol = state.symbol.split('/')[0];
      const symOrders = openOrders.filter((o: any) => {
        const sym: string = o.symbol ?? '';
        return sym.includes(baseSymbol);
      });

      let mapped = 0;
      const usedIdx = new Set<number>();
      for (const order of symOrders) {
        const price: number = order.price ?? 0;
        if (price <= 0) continue;
        // 找最近未使用的层（按价格距离）
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < state.gridLines.length; i++) {
          if (usedIdx.has(i)) continue;
          const d = Math.abs(state.gridLines[i].price - price);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        if (bestIdx >= 0) {
          usedIdx.add(bestIdx);
          const layer = state.gridLines[bestIdx];
          layer.state = 'pending';
          layer.orderId = order.orderId;
          layer.side = (order.side === 'sell') ? 'sell' : 'buy';
          layer.orderQuantity = order.quantity ?? 0;
          layer.positionSize = 0;
          layer.positionEntry = 0;
          // 同步更新 orderBook（orderId→layerIndex 映射，cancel_order 和头部挂单计数依赖此）
          if (order.orderId) state.orderBook[order.orderId] = bestIdx;
          mapped++;
        }
      }
      this.logger.log(
        `[网格] 容器重启恢复: 交易所挂单=${symOrders.length}, 映射到层=${mapped}（不取消）`,
      );
    } catch (e: any) {
      this.logger.warn(`[网格] 启动挂单恢复失败（忽略）: ${e.message}`);
    } finally {
      if (adapter) { try { await adapter.dispose(); } catch { /* ignore */ } }
    }
  }

  /**
   * nofx 对齐：取消交易所所有挂单（clean slate）
   * 等价于 nofx autoAdjustGrid 中 cancelAllGridOrders
   * 错误忽略（取消失败不阻塞启动）
   */
  private async cancelAllGridOrders(
    state: GridState,
    userId: string,
    apiKeyId: string,
  ): Promise<void> {
    if (!this.adapterFactory) return;
    let adapter: ExchangeAdapter | null = null;
    try {
      adapter = await this.adapterFactory.createAdapter(userId, apiKeyId);
      await adapter.cancelAllOrders(state.symbol);
      this.logger.log(`[网格] 启动: 已取消 ${state.symbol} 所有挂单（干净起点）`);
    } catch (e: any) {
      this.logger.warn(`[网格] 取消所有挂单失败（忽略，继续）: ${e.message}`);
    } finally {
      if (adapter) { try { await adapter.dispose(); } catch { /* ignore */ } }
    }
  }


  // ========================= 辅助方法 =========================

  /** 从持久化配置字段重建 gridLines 结构（不依赖 DB 中的 gridLines 数据）
   *  对齐 nofx：启动时 gridLines 始终从 config + exchange 重建，不信任 DB 快照
   */
  private buildGridLinesFromConfig(state: GridState): GridLine[] {
    const gridCount = state.gridCount
      || Math.round((state.upperPrice - state.lowerPrice) / (state.gridSpacing || 1)) + 1;
    if (gridCount <= 0 || state.upperPrice <= state.lowerPrice) return [];

    const weights = this.calculateWeights(gridCount, state.distribution ?? 'uniform');
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const lines: GridLine[] = [];

    for (let i = 0; i < gridCount; i++) {
      lines.push({
        index: i,
        price: Math.round((state.lowerPrice + i * state.gridSpacing) * 100) / 100,
        state: 'empty',
        side: 'buy',       // applyGridDirection 会重新赋值
        allocatedUSD: state.totalInvestment * (weights[i] / weightSum),
        orderQuantity: 0,
        positionSize: 0,
        positionEntry: 0,
        unrealizedPnl: 0,
        orderId: undefined,
      });
    }

    const centerPrice = (state.upperPrice + state.lowerPrice) / 2;
    this.applyGridDirection(lines, centerPrice, state.currentDirection ?? 'neutral');
    return lines;
  }

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

  /**
   * 重新初始化网格层级（每次重建都重算宽度，不继承旧边界）
   * 只负责重建网格结构（价格、分配、方向），所有层为 empty。
   * 对齐 nofx autoAdjustGrid L1424-1479：
   * 1. 保存当前内存中所有 filled 层（N 个）
   * 2. 重建所有层为 empty
   * 3. 每个 filled 层映射到最近的新层（N→N）
   *
   * @param preserveFilledFromMemory true=从内存保存 filled 层（配置变更重建）
   *                                 false=不保存，由调用方用 recoverPositionsFromExchange 恢复（容器重启）
   */
  private async reinitializeGridLevels(
    state: GridState,
    centerPrice: number,
    explicitUpper?: number,
    explicitLower?: number,
    preserveFilledFromMemory = true,
  ): Promise<void> {
    const gridCount = state.gridLines.length;

    if (explicitUpper && explicitLower && explicitUpper > explicitLower) {
      // 用户设定了百分比边界，按百分比重算后直接使用
      state.upperPrice = explicitUpper;
      state.lowerPrice = explicitLower;
      this.logger.log(
        `[网格] 重建范围(用户百分比): ${state.lowerPrice.toFixed(2)}-${state.upperPrice.toFixed(2)}`,
      );
    } else {
      // 无百分比配置 → ATR 自动计算（两套公式取小值）
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
            const chosenBasis = atrHalfRange <= defaultHalfRange ? `近期波动(4h ATR=${atr.toFixed(2)})` : `固定上限`;
            this.logger.log(
              `[网格] 重建范围: ATR半幅=${atrHalfRange.toFixed(4)}, 默认半幅=${defaultHalfRange.toFixed(4)}, 取小值=${halfRange.toFixed(4)}` +
              `\n       以当前价 ${centerPrice.toFixed(2)} 为中心，根据${chosenBasis}自动计算边界，半幅 ${halfRange.toFixed(2)}（ATR建议${atrHalfRange.toFixed(2)}，固定上限${defaultHalfRange.toFixed(2)}，取较小值）`,
            );
          }
        } catch (_e) {
          this.logger.log(
            `[网格] 重建范围(ATR获取失败，用默认公式): halfRange=${halfRange.toFixed(4)}` +
            `\n       ATR获取失败，按固定比例计算边界，半幅 ${halfRange.toFixed(2)}`,
          );
        }
      }
      state.upperPrice = centerPrice + halfRange;
      state.lowerPrice = centerPrice - halfRange;
    }
    state.gridSpacing = (state.upperPrice - state.lowerPrice) / (gridCount - 1);

    // nofx autoAdjustGrid L1424-1429：保存当前内存中所有 filled 层
    const filledSnapshots: Array<{ positionEntry: number; positionSize: number; side: string; unrealizedPnl: number }> = [];
    if (preserveFilledFromMemory) {
      for (const line of state.gridLines) {
        if (line.state === 'filled' && (line.positionSize ?? 0) > 0.0001) {
          filledSnapshots.push({
            positionEntry: line.positionEntry ?? line.price,
            positionSize: line.positionSize ?? 0,
            side: line.side,
            unrealizedPnl: line.unrealizedPnl ?? 0,
          });
        }
      }
    }

    // 重建所有层为 empty
    const weights = this.calculateWeights(gridCount, state.distribution);
    const weightSum = weights.reduce((a, b) => a + b, 0);

    for (let i = 0; i < gridCount; i++) {
      const line = state.gridLines[i];
      line.price = Math.round((state.lowerPrice + i * state.gridSpacing) * 100) / 100;
      line.allocatedUSD = state.totalInvestment * (weights[i] / weightSum);
      line.state = 'empty';
      line.orderId = undefined;
      line.orderQuantity = 0;
      line.positionSize = 0;
      line.positionEntry = 0;
      line.unrealizedPnl = 0;
    }

    this.applyGridDirection(state.gridLines, centerPrice, state.currentDirection);
    state.orderBook = {};

    // nofx autoAdjustGrid L1456-1479：持仓锚点映射（按方向向内侧连续排列，防止持仓跨入反向区域）
    if (filledSnapshots.length > 0) {
      const buySnaps = filledSnapshots.filter(s => s.side === 'buy');
      const sellSnaps = filledSnapshots.filter(s => s.side === 'sell');

      const mapSnapsToLayers = (snaps: typeof filledSnapshots, side: 'buy' | 'sell') => {
        if (snaps.length === 0) return;
        // 锚点入场价：买→最高（靠近当前价下方），卖→最低（靠近当前价上方）
        const anchorEntry = side === 'buy'
          ? Math.max(...snaps.map(s => s.positionEntry))
          : Math.min(...snaps.map(s => s.positionEntry));

        const emptyLayers = state.gridLines
          .map((l, idx) => ({ layer: l, idx }))
          .filter(({ layer }) => layer.state === 'empty');

        // 锚点层：距离 anchorEntry 最近的空层
        const anchorSlot = [...emptyLayers]
          .sort((a, b) => Math.abs(a.layer.price - anchorEntry) - Math.abs(b.layer.price - anchorEntry))[0];
        if (!anchorSlot) return;

        // 从锚点向内侧连续取 N 层（买→锚点及以下，卖→锚点及以上）
        const slots = emptyLayers
          .filter(({ idx }) => side === 'buy' ? idx <= anchorSlot.idx : idx >= anchorSlot.idx)
          .sort((a, b) => side === 'buy' ? b.idx - a.idx : a.idx - b.idx)
          .slice(0, snaps.length);

        // 入场价排序对应层位（买：高价→高层；卖：低价→低层）
        const sortedSnaps = [...snaps].sort((a, b) =>
          side === 'buy' ? b.positionEntry - a.positionEntry : a.positionEntry - b.positionEntry
        );

        for (let i = 0; i < slots.length; i++) {
          const { layer, idx } = slots[i];
          const snap = sortedSnaps[i] ?? sortedSnaps[sortedSnaps.length - 1];
          layer.state = 'filled';
          layer.positionEntry = snap.positionEntry;
          layer.positionSize = snap.positionSize;
          layer.side = side;
          layer.unrealizedPnl = snap.unrealizedPnl;
          layer.orderId = undefined;
          layer.orderQuantity = 0;
          this.logger.log(
            `[网格] 重建持仓恢复: ${side === 'buy' ? '多' : '空'}头 ` +
            `qty=${snap.positionSize.toFixed(4)} entry=${snap.positionEntry.toFixed(4)} ` +
            `→ L${idx + 1}@${layer.price.toFixed(4)}`,
          );
        }
      };

      mapSnapsToLayers(buySnaps, 'buy');
      mapSnapsToLayers(sellSnaps, 'sell');

      this.logger.log(
        `[网格] 重建网格: 范围 ${state.lowerPrice.toFixed(2)}-${state.upperPrice.toFixed(2)}` +
        `，共 ${gridCount} 层，格间距 ${state.gridSpacing.toFixed(2)}` +
        `，从内存恢复 ${filledSnapshots.length} 个持仓层`,
      );
    } else {
      this.logger.log(
        `[网格] 重建网格: 范围 ${state.lowerPrice.toFixed(2)}-${state.upperPrice.toFixed(2)}` +
        `，共 ${gridCount} 层，格间距 ${state.gridSpacing.toFixed(2)}` +
        `${preserveFilledFromMemory ? '（无持仓）' : '（待 recoverPositionsFromExchange 恢复持仓）'}`,
      );
    }
  }

  /**
   * 检查网格是否严重倾斜（对齐 nofx checkGridSkew）
   * 倾斜条件：单侧填满且另侧 empty>5，或一侧 filled ≥ 3× 另一侧且 filled>5
   * @param displayLines 从交易所数据构建的层级（优先）；不传则 fallback 到 state.gridLines
   */
  private checkGridSkew(
    state: GridState,
    displayLines?: any[],
  ): { skewed: boolean; buyFilled: number; sellFilled: number } {
    let buyFilled: number, sellFilled: number, buyEmpty: number, sellEmpty: number;

    if (displayLines && displayLines.length > 0) {
      // 从交易所数据统计（和 UI / AI 完全一致）
      buyFilled  = displayLines.filter((d: any) => d.st === 'filled' && d.s === 'buy').length;
      sellFilled = displayLines.filter((d: any) => d.st === 'filled' && d.s === 'sell').length;
      buyEmpty   = displayLines.filter((d: any) => d.s === 'buy' && (d.st === 'empty' || !d.st)).length;
      sellEmpty  = displayLines.filter((d: any) => d.s === 'sell' && (d.st === 'empty' || !d.st)).length;
    } else {
      // 无交易所数据时返回不倾斜（不用内存判断，等下轮交易所恢复）
      this.logger.warn(`[网格] checkGridSkew: 无交易所数据，跳过倾斜检查`);
      return { skewed: false, buyFilled: 0, sellFilled: 0 };
    }

    let skewed = false;
    if (buyFilled > 0 && sellFilled === 0 && sellEmpty > 5) skewed = true;
    else if (sellFilled > 0 && buyFilled === 0 && buyEmpty > 5) skewed = true;
    else if (buyFilled >= 3 * sellFilled && buyFilled > 5) skewed = true;
    else if (sellFilled >= 3 * buyFilled && sellFilled > 5) skewed = true;

    return { skewed, buyFilled, sellFilled };
  }

  /**
   * 后端自动重建（对齐 nofx autoAdjustGrid）
   * 触发条件：严重倾斜 AND 价格偏移 > autoAdjustThreshold × gridRange
   * 重建后自动映射 filled 持仓到最近层，解除非风控暂停
   */
  private async autoAdjustGrid(
    state: GridState,
    adapter: GridExchangeAdapter,
    currentPrice: number,
    autoAdjustThreshold: number = 0.2,
    strategyId?: string,
    userId?: string,
    apiKeyId?: string,
    displayLines?: any[],  // 从交易所数据构建的层级（消除内存依赖）
  ): Promise<void> {
    const { skewed, buyFilled, sellFilled } = this.checkGridSkew(state, displayLines);
    if (!skewed) return;

    const gridRange = state.upperPrice - state.lowerPrice;
    if (gridRange <= 0) return;
    const midPrice = (state.upperPrice + state.lowerPrice) / 2;
    const priceDeviation = Math.abs(currentPrice - midPrice);

    if (priceDeviation < gridRange * autoAdjustThreshold) return;

    // 重建前：记录旧状态
    const oldUpper = state.upperPrice;
    const oldLower = state.lowerPrice;
    const oldPending = state.gridLines.filter(l => l.state === 'pending').length;
    const oldFilled = state.gridLines.filter(l => l.state === 'filled').length;

    this.logger.warn(
      `[网格] ⚡ 自动重建触发: 倾斜 buy=${buyFilled} sell=${sellFilled}，` +
      `价格偏移 ${((priceDeviation / gridRange) * 100).toFixed(1)}% > ${(autoAdjustThreshold * 100).toFixed(0)}% 阈值 | ` +
      `旧范围=${oldLower.toFixed(2)}~${oldUpper.toFixed(2)}, 当前价=${currentPrice.toFixed(2)}, ` +
      `旧状态: ${oldPending}挂单 + ${oldFilled}持仓`,
    );

    // Step 1: 撤销交易所所有挂单
    try {
      await adapter.cancelAllOrders(state.symbol);
      this.logger.log(`[网格] 自动重建 Step1: 撤销交易所所有挂单（${oldPending}个）✓`);
    } catch (e: any) {
      this.logger.warn(`[网格] 自动重建 Step1: 撤单失败（继续重建）: ${e.message}`);
    }

    // Step 2: 重建网格（全部 empty）
    let newUpper: number, newLower: number;
    if (state.upperBoundPct && state.lowerBoundPct) {
      newUpper = currentPrice * (1 + state.upperBoundPct / 100);
      newLower = currentPrice * (1 - state.lowerBoundPct / 100);
      await this.reinitializeGridLevels(state, currentPrice, newUpper, newLower);
    } else {
      await this.reinitializeGridLevels(state, currentPrice);
      newUpper = state.upperPrice;
      newLower = state.lowerPrice;
    }
    this.logger.log(
      `[网格] 自动重建 Step2: 网格重置 ${state.gridLines.length}层 empty | ` +
      `新范围=${newLower.toFixed(2)}~${newUpper.toFixed(2)}, 格间距=${state.gridSpacing.toFixed(4)}`,
    );

    // Step 3: reinitializeGridLevels 已从内存保存 filled 层并恢复（对齐 nofx autoAdjustGrid L1424-1479）
    const recoveredFilled2 = state.gridLines.filter(l => l.state === 'filled').length;
    const emptyCount = state.gridLines.filter(l => l.state === 'empty').length;

    this.logger.log(
      `[网格] ⚡ 自动重建完成: ${oldLower.toFixed(2)}~${oldUpper.toFixed(2)} → ${newLower.toFixed(2)}~${newUpper.toFixed(2)} | ` +
      `撤${oldPending}单, 恢复${recoveredFilled2}持仓, ${emptyCount}空格待AI补单`,
    );

    // 写入策略日志，让前端用户看到自动重建事件
    if (strategyId) {
      const rebuildRangePct = ((newUpper - newLower) / currentPrice * 100).toFixed(1);
      try {
        await this.prisma.aiStrategyLog.create({
          data: {
            strategyId,
            symbol: state.symbol,
            decision: {
              action: 'grid_rebuild',
              gridSummary: `自动重建/倾斜${buyFilled}买${sellFilled}卖`,
              reasoning: `网格严重倾斜（多头${buyFilled}层/空头${sellFilled}层），价格偏移超过阈值，自动重新居中` +
                `\n旧范围: $${oldLower.toFixed(2)} ~ $${oldUpper.toFixed(2)}` +
                `\n新范围: $${newLower.toFixed(2)} ~ $${newUpper.toFixed(2)} (${rebuildRangePct}%)` +
                `\n撤销${oldPending}个挂单，恢复${recoveredFilled2}层持仓，${emptyCount}空格待AI补单` +
                `\n当前价: $${currentPrice.toFixed(4)}`,
              gridSnapshot: {
                upperPrice: newUpper,
                lowerPrice: newLower,
                gridSpacing: state.gridSpacing,
                direction: state.currentDirection,
                totalLevels: state.gridLines.length,
                totalInvestment: state.totalInvestment,
                leverage: state.leverage,
                lastPrice: currentPrice,
                totalProfit: state.totalProfit,
                totalTrades: state.totalTrades,
                gridLines: state.gridLines.map((l) => ({
                  lv: l.index + 1,
                  st: l.state === 'filled' ? 'F' : l.state === 'pending' ? 'P' : '-',
                  px: Number((l.price ?? 0).toFixed(2)),
                  sd: l.side === 'buy' ? 'B' : l.side === 'sell' ? 'S' : '-',
                  qty: Number((l.positionSize ?? 0).toFixed(4)),
                })),
              },
            } as any,
            executed: true,
          },
        });
      } catch (logErr: any) {
        this.logger.warn(`[网格] 自动重建日志写入失败: ${logErr.message}`);
      }
    }

    // 重建后自动解除非风控暂停
    if (state.isPaused && state.pauseSource !== 'risk_control') {
      state.isPaused = false;
      state.pauseSource = undefined;
      state.pauseReason = undefined;
      this.logger.log(`[网格] 自动重建: 解除暂停（非风控）`);
    }

    state.orderBook = {};
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
      // gridLines 动态状态存 DB（state/orderId/positionSize/positionEntry）
      // 重启时用 config 结构 + DB 动态状态合并，保留多层 filled 信息
      // orderBook 运行时索引不存 DB（重建时从 gridLines 重建）
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { orderBook, _pendingStopLoss, ...stateToSave } = state as any;
      stateToSave.gridCount = state.gridLines?.length ?? state.gridCount ?? 0;  // 保留层数，重建时用

      const equityPnl = state.lastEquity && state.startEquity > 0
        ? state.lastEquity - state.startEquity
        : 0;
      const winRate = state.totalTrades > 0
        ? Math.round((state.winningTrades / state.totalTrades) * 100 * 100) / 100
        : 0;
      await this.prisma.aiStrategy.update({
        where: { id: strategyId },
        data: { gridRuntimeState: stateToSave as any },
      });
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
        if (state.lastEquity === undefined) state.lastEquity = state.peakEquity;
        // gridLines 恢复策略：config 提供价格结构，DB 提供动态状态（filled/orderId/positionSize）
        // 这样重启后可以保留多层 filled 信息，syncOrderFills 首轮检测重启期间的成交/撤单
        const configLines = this.buildGridLinesFromConfig(state);
        const dbLines = (state.gridLines as any[]) ?? [];
        if (dbLines.length === configLines.length) {
          // DB 层数与 config 一致：config 结构 + DB 动态状态合并
          for (let i = 0; i < configLines.length; i++) {
            const db = dbLines[i];
            if (db) {
              configLines[i].state       = db.state       ?? 'empty';
              configLines[i].orderId     = db.orderId     ?? undefined;
              configLines[i].orderQuantity = db.orderQuantity ?? 0;
              configLines[i].positionSize  = db.positionSize  ?? 0;
              configLines[i].positionEntry = db.positionEntry ?? 0;
              configLines[i].unrealizedPnl = db.unrealizedPnl ?? 0;
            }
          }
          state.gridLines = configLines;
          const filledCount = configLines.filter(l => l.state === 'filled').length;
          const pendingCount = configLines.filter(l => l.state === 'pending').length;
          this.logger.log(`[网格] 从数据库恢复状态: ${strategyId}（DB+config合并，filled=${filledCount}层, pending=${pendingCount}层）`);
        } else {
          // 层数不一致（配置已变更）：从配置重建
          state.gridLines = configLines;
          this.logger.log(`[网格] 从数据库恢复状态: ${strategyId}（层数变更，从配置重建，共 ${configLines.length} 层）`);
        }
        // orderBook 从 gridLines 重建（pending 层的 orderId → levelIndex 映射）
        state.orderBook = {};
        for (const line of state.gridLines) {
          if (line.state === 'pending' && line.orderId) {
            state.orderBook[line.orderId] = line.index ?? 0;
          }
        }
        this.gridStates.set(strategyId, state);
        return state;
      }
      return null;
    } catch (error: any) {
      this.logger.warn(`[网格] 加载状态失败 ${strategyId}: ${error.message}`);
      return null;
    }
  }

  /** 持久化一条已关闭的仓位记录到 position 表（历史持仓展示用） */
  private saveClosedPositionRecord(
    userId: string,
    strategyId: string,
    exchange: string,
    symbol: string,
    side: 'long' | 'short',
    entryPrice: number,
    exitPrice: number,
    quantity: number,
    leverage: number,
    realizedPnl: number,
    closeReason: string,
  ): void {
    // 异步写入，不阻塞主流程
    const margin = quantity > 0 && leverage > 0 ? (entryPrice * quantity) / leverage : 0;
    this.prisma.position.create({
      data: {
        userId,
        exchange,
        symbol,
        side,
        entryPrice: entryPrice.toString(),
        exitPrice: exitPrice.toString(),
        closePrice: exitPrice.toString(),
        amount: quantity.toString(),
        tradingType: 'futures',
        leverage,
        margin: margin.toString(),
        realizedPnl: realizedPnl.toString(),
        pnl: realizedPnl.toString(),
        status: 'closed',
        closeReason,
        closedAt: new Date(),
        source: 'ai_strategy',
        aiStrategyId: strategyId,
        createdAt: new Date(),
      },
    }).catch((e: any) => this.logger.warn(`[网格] 历史持仓写入失败(忽略): ${e.message}`));
  }

  /**
   * 从交易所数据构建层级显示（不读内存 state.gridLines 的状态）
   * 三种状态：pending=交易所有挂单, filled=交易所有持仓, empty=交易所无数据
   * 用于前端展示，确保和交易所实时数据一致
   */
  private buildDisplayFromExchange(
    state: GridState,
    exchangeOpenOrders: any[],
    exchangePositions: any[],
  ): any[] {
    const leverage = Math.max(1, state.leverage ?? 1);
    const currentPrice = state.lastPrice ?? 0;

    // 初始化所有层为 empty
    const display: any[] = state.gridLines.map((l, i) => ({
      lv: i + 1,
      p: +l.price.toFixed(4),
      s: l.side,
      st: 'empty',
    }));

    // Step 1: 用交易所挂单标记 pending 层
    // 通过 orderId 精确匹配（内存 gridLines 中的 orderId→层 映射）
    const orderIdToLayerIdx = new Map<string, number>();
    for (let i = 0; i < state.gridLines.length; i++) {
      const oid = state.gridLines[i].orderId;
      if (oid) orderIdToLayerIdx.set(oid, i);
    }

    for (const order of exchangeOpenOrders) {
      // adapter 返回标准化字段：orderId（非 CCXT 原生 id）、quantity（非 CCXT 原生 amount）
      const oid = order.orderId ?? order.id;
      if (!oid) continue;
      const idx = orderIdToLayerIdx.get(oid);
      if (idx !== undefined && idx < display.length) {
        display[idx].st = 'pending';
        display[idx].oid = oid.slice(-8);
        display[idx].qty = +(order.quantity ?? order.amount ?? 0).toFixed(4);
      }
    }

    // Step 2: 用交易所持仓标记 filled 层
    // 1 持仓 → 1 最近空层（对齐 nofx autoAdjustGrid + recoverPositionsFromExchange）
    const baseSymbol = state.symbol.split('/')[0];
    for (const pos of exchangePositions) {
      if (!pos.symbol?.includes(baseSymbol)) continue;
      const totalQty = pos.quantity ?? 0;
      if (totalQty <= 0.0001) continue;

      const rawSide = pos.side as string;
      const posSide = (rawSide === 'long' || rawSide === 'net' || !rawSide) ? 'buy' : 'sell';
      const avgEntry = (pos.entryPrice ?? 0) > 0 ? pos.entryPrice : currentPrice;

      // 优先用内存中已标记为 filled 的层（正常交易积累的持仓）
      const memoryFilledLayers = state.gridLines
        .map((gl, i) => ({ gl, i }))
        .filter(({ gl }) => gl.state === 'filled' && (gl.positionSize ?? 0) > 0.0001);

      if (memoryFilledLayers.length > 0) {
        // 内存有 filled 层，按内存映射显示（正常交易期间每层独立持仓）
        for (const { gl, i } of memoryFilledLayers) {
          if (i < display.length) {
            display[i].st = 'filled';
            display[i].s = gl.side || posSide;
            display[i].qty = +(gl.positionSize ?? 0).toFixed(4);
            display[i].ep = +(gl.positionEntry ?? gl.price).toFixed(4);
          }
        }
      } else {
        // 内存无 filled 层（启动时），按交易所持仓均价为锚点，向内侧连续映射
        const avgAllocatedUSD = state.totalInvestment / state.gridLines.length;
        const perLayerQty = avgAllocatedUSD * leverage / avgEntry;
        const estLayers = perLayerQty > 0.0001
          ? Math.max(1, Math.round(totalQty / perLayerQty))
          : 1;

        const emptySlots = display
          .map((dd, i) => ({ dd, i, gl: state.gridLines[i] }))
          .filter(({ dd }) => dd.st === 'empty');

        // 锚点：距离 avgEntry 最近的空槽
        const anchorSlot = [...emptySlots]
          .sort((a, b) => Math.abs(a.gl.price - avgEntry) - Math.abs(b.gl.price - avgEntry))[0];

        if (anchorSlot) {
          // 从锚点向内侧连续取 estLayers 层（买→锚点及以下，卖→锚点及以上）
          const slots = emptySlots
            .filter(({ i }) => posSide === 'buy' ? i <= anchorSlot.i : i >= anchorSlot.i)
            .sort((a, b) => posSide === 'buy' ? b.i - a.i : a.i - b.i)
            .slice(0, estLayers);

          const qtyEach = totalQty / Math.max(1, slots.length);
          for (const { dd } of slots) {
            dd.st = 'filled';
            dd.s = posSide;
            dd.qty = +qtyEach.toFixed(4);
            dd.ep = +avgEntry.toFixed(4);
          }
        }
      }
    }

    return display;
  }

  private async saveGridDecisionLog(
    strategyId: string,
    symbol: string,
    decisions: GridDecision[],
    cost: number,
    state?: GridState,
    thinking?: string,
    execResults?: Array<{ action: string; level?: number; success: boolean; skipped?: boolean; skipReason?: string; error?: string }>,
    marketAnalysis?: string,
    preExecGridLines?: any[],  // syncOrderFills 后的层级快照（交易所真实状态）
    locale?: string,           // 用户语言（用于 gridSummary 翻译）
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
          parts.push(`${this.actionLabel(act, locale)}×${cnt}`);
        }
      }
      const gridSummary = parts.join('/') || `${decisions.length}ops`;

      // 构建 GridState 快照
      // 表头统计优先从 preExecGridLines（pre-sync 交易所数据）统计
      // 确保持仓格/挂单层和层级显示一致（都是 AI 决策前的交易所状态）
      const displayFilled = preExecGridLines
        ? preExecGridLines.filter((g: any) => g.st === 'filled').length
        : state?.gridLines.filter(l => l.state === 'filled').length ?? 0;
      const displayPending = preExecGridLines
        ? preExecGridLines.filter((g: any) => g.st === 'pending').length
        : state?.gridLines.filter(l => l.state === 'pending').length ?? 0;
      const gridSnapshot = state ? {
        upperPrice: state.upperPrice,
        lowerPrice: state.lowerPrice,
        gridSpacing: state.gridSpacing,
        direction: state.currentDirection,
        regime: state.currentRegime,
        totalLevels: state.gridLines.length,
        filledLevels: displayFilled,
        pendingLevels: displayPending,
        activeOrders: displayPending,
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
        leverage: state.leverage,                   // 配置杠杆（固定值 / AI默认上限）
        effectiveLeverage: state.leverage,            // 已废弃，始终等于 leverage（对齐 nofx）
        recommendedLeverage: state.recommendedLeverage, // min(leverage, regimeCap)，仅展示
        userFixedLeverage: state.userFixedLeverage ?? true,
        breakoutLevel: state.breakoutLevel,
        lastPrice: state.lastPrice,
        startEquity: state.startEquity,
        currentProfitPct: state.startEquity > 0 && state.lastEquity
          ? (state.lastEquity - state.startEquity) / state.startEquity * 100
          : 0,
        // 每层详情：使用 syncOrderFills 后的快照（交易所真实状态），fallback 到 state.gridLines
        gridLines: preExecGridLines ?? state.gridLines.map((l, i) => {
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
            entry.oid = l.orderId?.slice(-8) ?? '';
            entry.qty = +(l.orderQuantity ?? 0).toFixed(4);
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
                errors: failedResults.map(r => ({ action: r.action, level: r.level, error: r.error })),
              }),
              ...(skippedResults.length > 0 && {
                skipped: skippedResults.map(r => ({ action: r.action, level: r.level, reason: r.skipReason })),
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
    if (config.leverage !== undefined) {
      const isNewAI = config.leverage == null || config.leverage <= 0;
      const isOldAI = !state.userFixedLeverage;
      if (isNewAI !== isOldAI || (!isNewAI && config.leverage !== state.leverage)) {
        diffs.push(`杠杆 ${isOldAI ? 'AI动态' : state.leverage + 'x'}→${isNewAI ? 'AI动态' : config.leverage + 'x'}`);
      }
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
    // 用户设定的百分比边界变更（0 = 未设定）
    const oldUpperPct = state.upperBoundPct ?? 0;
    const newUpperPct = config.upperBoundPct ?? 0;
    if (Math.abs(oldUpperPct - newUpperPct) > 0.01) {
      diffs.push(`上界 ${oldUpperPct}%→${newUpperPct}%`);
    }
    const oldLowerPct = state.lowerBoundPct ?? 0;
    const newLowerPct = config.lowerBoundPct ?? 0;
    if (Math.abs(oldLowerPct - newLowerPct) > 0.01) {
      diffs.push(`下界 ${oldLowerPct}%→${newLowerPct}%`);
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
    this.reconcileCompleted.delete(strategyId);  // 下次启动重新执行 exchange 恢复
    this.neutralSideCorrected.delete(strategyId); // 下次启动重新执行 neutral side 修正
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
