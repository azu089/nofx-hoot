/**
 * 量化交易平台 - 完整配置类型定义
 * 覆盖所有交易场景和市场状况
 */

// ========== 1. 平台级配置 (Platform Config) ==========

/**
 * 平台全局配置 - 由管理员控制
 */
export interface PlatformConfig {
  // === 系统开关 ===
  tradingEnabled: boolean; // 全局交易开关
  newOrdersEnabled: boolean; // 允许新开仓（可单独关闭新开仓但允许平仓）
  withdrawEnabled: boolean; // 提现开关

  // === 全局限制 ===
  maxConcurrentOrders: number; // 全平台最大并发订单数
  maxOrdersPerMinute: number; // 每分钟最大订单数（防止 API 限流）
  minOrderAmountUsdt: number; // 最小订单金额
  maxOrderAmountUsdt: number; // 最大单笔订单金额

  // === 支持的交易所 ===
  supportedExchanges: string[]; // ['binance', 'okx', 'bybit']

  // === 支持的交易对（白名单模式） ===
  allowedSymbols: string[]; // 允许交易的币种，空数组表示不限制
  blockedSymbols: string[]; // 禁止交易的币种（优先级高于 allowed）

  // === 市场状态配置 ===
  marketStatus: MarketStatusConfig;

  // === 紧急熔断配置 ===
  circuitBreaker: CircuitBreakerConfig;

  // === 系统维护 ===
  maintenanceMode: boolean;
  maintenanceMessage?: string;
}

/**
 * 市场状态配置
 */
export interface MarketStatusConfig {
  // 波动率检测
  volatilityCheckEnabled: boolean;
  maxVolatility24h: number; // 24小时最大波动率(%)，超过则暂停交易
  volatilityCheckInterval: number; // 检测间隔(秒)

  // 流动性检测
  liquidityCheckEnabled: boolean;
  minOrderBookDepth: number; // 最小订单簿深度(USDT)

  // 极端行情保护
  extremeMarketProtection: boolean;
  priceDeviationThreshold: number; // 价格偏离阈值(%)，与前一分钟对比
}

/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
  enabled: boolean;

  // 连续失败熔断
  maxConsecutiveFailures: number; // 连续失败次数触发熔断
  failureWindowSeconds: number; // 统计窗口(秒)

  // 错误率熔断
  errorRateThreshold: number; // 错误率阈值(%)
  errorRateWindowSeconds: number; // 错误率统计窗口(秒)
  minRequestsForErrorRate: number; // 最小请求数才计算错误率

  // 恢复配置
  cooldownSeconds: number; // 熔断冷却时间(秒)
  halfOpenRequests: number; // 半开状态允许的测试请求数
}

// ========== 2. 用户级配置 (User Config) ==========

/**
 * 用户风控配置
 */
export interface UserRiskConfig {
  // === 仓位限制 ===
  maxOpenPositions: number; // 最大同时持仓数
  maxPositionsPerSymbol: number; // 单币种最大持仓数（允许加仓时 > 1）
  maxTotalExposureUsdt: number; // 最大总敞口(USDT)

  // === 单笔限制 ===
  maxSingleOrderUsdt: number; // 单笔最大金额
  minSingleOrderUsdt: number; // 单笔最小金额

  // === 日内限制 ===
  maxDailyTrades: number; // 每日最大交易次数
  maxDailyLossUsdt: number; // 每日最大亏损额(USDT)
  maxDailyLossPercent: number; // 每日最大亏损比例(%)

  // === 最大回撤 ===
  maxDrawdownPercent: number; // 最大回撤比例(%)
  drawdownWindowDays: number; // 回撤计算窗口(天)
  pauseOnMaxDrawdown: boolean; // 达到最大回撤时暂停交易

  // === 杠杆限制 ===
  maxLeverage: number; // 最大允许杠杆
  defaultLeverage: number; // 默认杠杆

  // === 币种限制 ===
  allowedSymbols: string[]; // 用户级允许交易的币种
  blockedSymbols: string[]; // 用户级禁止交易的币种
}

/**
 * 用户资金管理配置
 */
export interface UserFundConfig {
  // === 资金分配策略 ===
  allocationStrategy: 'fixed' | 'percent' | 'kelly' | 'martingale';

  // Fixed: 固定金额
  fixedAmountUsdt?: number;

  // Percent: 按余额百分比
  percentOfBalance?: number;

  // Kelly: 凯利公式
  kellyFraction?: number; // 凯利系数(0-1)，通常用 0.5 Kelly

  // Martingale: 马丁格尔（风险较高）
  martingaleMultiplier?: number;
  martingaleMaxSteps?: number;

  // === 保留余额 ===
  reserveBalanceUsdt: number; // 保留余额，不用于交易
  reserveBalancePercent: number; // 保留余额百分比

  // === 复利设置 ===
  compoundEnabled: boolean; // 是否启用复利
  compoundThreshold: number; // 复利触发阈值(USDT)

  // === 亏损后调整 ===
  reduceAfterLoss: boolean; // 亏损后是否减少仓位
  lossReductionPercent: number; // 亏损后减少比例(%)
  lossRecoveryTrades: number; // 恢复正常仓位所需盈利次数
}

/**
 * 用户通知配置
 */
export interface UserNotificationConfig {
  // === 通知渠道 ===
  channels: {
    inApp: boolean;
    telegram: boolean;
    email: boolean;
    webhook?: string; // 自定义 webhook URL
  };

  // === 通知类型开关 ===
  notifications: {
    signalReceived: boolean; // 收到信号
    orderExecuted: boolean; // 订单执行
    orderFailed: boolean; // 订单失败
    positionOpened: boolean; // 开仓
    positionClosed: boolean; // 平仓
    stopLossTriggered: boolean; // 触发止损
    takeProfitTriggered: boolean; // 触发止盈
    dailySummary: boolean; // 每日汇总
    weeklySummary: boolean; // 每周汇总
    riskAlert: boolean; // 风控告警
    systemAlert: boolean; // 系统告警
  };

  // === 静默时段 ===
  quietHours: {
    enabled: boolean;
    startHour: number; // 0-23
    endHour: number;
    timezone: string; // 'Asia/Shanghai'
  };
}

/**
 * 用户交易时段配置
 */
export interface UserTradingHoursConfig {
  enabled: boolean; // 是否限制交易时段

  // 允许交易的时段
  allowedPeriods: Array<{
    dayOfWeek: number[]; // 0-6, 0=周日
    startHour: number;
    endHour: number;
    timezone: string;
  }>;

  // 避开的特殊时段（如重大数据发布）
  blackoutPeriods: Array<{
    name: string;
    start: string; // ISO 日期时间
    end: string;
  }>;
}

// ========== 3. 订阅级配置 (Subscription Config) ==========

/**
 * 策略订阅配置 - 完整版
 */
export interface SubscriptionConfig {
  // === 基础配置 ===
  basic: {
    apiKeyId: string;
    isActive: boolean;
  };

  // === 交易类型 ===
  tradingType: TradingTypeConfig;

  // === 订单执行 ===
  execution: ExecutionConfig;

  // === 仓位管理 ===
  position: PositionConfig;

  // === 止盈止损 ===
  riskManagement: RiskManagementConfig;

  // === 信号处理 ===
  signalHandling: SignalHandlingConfig;
}

/**
 * 交易类型配置
 */
export interface TradingTypeConfig {
  type: 'spot' | 'futures';

  // 合约专用
  futures?: {
    leverage: number;
    marginMode: 'cross' | 'isolated';
    positionMode: 'one_way' | 'hedge'; // 单向持仓 / 双向持仓
  };
}

/**
 * 订单执行配置
 */
export interface ExecutionConfig {
  // === 订单类型 ===
  orderType: 'market' | 'limit' | 'limit_ioc';

  // === 滑点控制 ===
  slippage: {
    tolerancePercent: number; // 滑点容忍度(%)
    checkEnabled: boolean; // 是否检查实际滑点
    maxAcceptablePercent: number; // 最大可接受滑点(%)
  };

  // === 限价单配置 ===
  limitOrder?: {
    priceOffsetPercent: number; // 相对市价的偏移(%)
    timeInForce: 'GTC' | 'IOC' | 'FOK';
    validSeconds: number; // 有效期(秒)
    cancelIfNotFilled: boolean; // 超时未成交则取消
  };

  // === 重试配置 ===
  retry: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier: number; // 退避乘数
    retryOnErrors: string[]; // 触发重试的错误类型
  };

  // === 超时配置 ===
  timeout: {
    orderPlacementMs: number; // 下单超时
    orderConfirmationMs: number; // 订单确认超时
    positionCheckMs: number; // 持仓检查超时
  };

  // === 并发控制 ===
  concurrency: {
    maxConcurrentOrders: number; // 最大并发订单
    orderIntervalMs: number; // 订单间隔(ms)
  };
}

/**
 * 仓位管理配置
 */
export interface PositionConfig {
  // === 开仓配置 ===
  entry: {
    amountType: 'fixed' | 'percent' | 'signal'; // 固定/百分比/信号指定
    fixedAmountUsdt?: number;
    percentOfBalance?: number;
    maxAmountUsdt: number; // 最大开仓金额

    // 分批开仓
    scaling: {
      enabled: boolean;
      steps: number; // 分几批
      intervalSeconds: number; // 批次间隔
    };
  };

  // === 加仓配置 ===
  pyramiding: {
    enabled: boolean;
    maxAdds: number; // 最大加仓次数
    addCondition: 'profit' | 'loss' | 'signal'; // 加仓条件
    addThresholdPercent: number; // 触发加仓的盈亏阈值(%)
    addAmountPercent: number; // 加仓金额占初始仓位的比例(%)
  };

  // === 平仓配置 ===
  exit: {
    autoCloseOnSignal: boolean; // 收到卖出信号自动平仓
    partialCloseEnabled: boolean; // 允许部分平仓

    // 分批平仓
    scaling: {
      enabled: boolean;
      steps: number;
      percentPerStep: number[]; // 每步平仓比例，如 [30, 30, 40]
    };
  };

  // === 最大持仓数 ===
  maxPositions: number;
  allowSameSymbol: boolean; // 允许同币种多仓位
}

/**
 * 风险管理配置（止盈止损）
 */
export interface RiskManagementConfig {
  // === 止损 ===
  stopLoss: {
    enabled: boolean;
    type: 'fixed' | 'trailing' | 'atr'; // 固定/追踪/ATR
    fixedPercent?: number;

    // 追踪止损
    trailing?: {
      activationPercent: number; // 激活追踪的盈利比例
      trailingPercent: number; // 追踪距离
      stepPercent?: number; // 阶梯追踪步长
    };

    // ATR 止损
    atr?: {
      period: number;
      multiplier: number;
    };
  };

  // === 止盈 ===
  takeProfit: {
    enabled: boolean;
    type: 'fixed' | 'scaled'; // 固定/分批

    fixedPercent?: number;

    // 分批止盈
    scaled?: Array<{
      targetPercent: number; // 目标盈利
      closePercent: number; // 平仓比例
    }>;
  };

  // === 时间止损 ===
  timeBasedExit: {
    enabled: boolean;
    maxHoldingHours: number; // 最大持仓时间
    exitIfNotProfitable: boolean; // 如果不盈利才退出
  };

  // === 盈亏比要求 ===
  riskReward: {
    checkEnabled: boolean;
    minRatio: number; // 最小盈亏比，如 1.5
  };
}

/**
 * 信号处理配置
 */
export interface SignalHandlingConfig {
  // === 信号过滤 ===
  filter: {
    minConfidence?: number; // 最小置信度（如果信号带置信度）
    allowedSides: ('buy' | 'sell')[]; // 允许的方向
    symbolFilter?: string[]; // 只接受特定币种的信号
  };

  // === 信号有效期 ===
  validity: {
    maxAgeSeconds: number; // 信号最大有效期
    priceDeviationPercent: number; // 价格偏离信号价格的最大比例
  };

  // === 信号确认 ===
  confirmation: {
    requireManual: boolean; // 需要手动确认
    autoConfirmBelow: number; // 低于此金额自动确认
    confirmationTimeoutSeconds: number;
  };

  // === 信号冲突处理 ===
  conflict: {
    // 收到反向信号时
    onOppositeSignal: 'ignore' | 'close_and_reverse' | 'close_only';

    // 已有持仓时收到同向信号
    onSameDirectionSignal: 'ignore' | 'add_position' | 'ignore_if_profitable';
  };

  // === 信号队列 ===
  queue: {
    maxPendingSignals: number;
    processingOrder: 'fifo' | 'lifo' | 'priority';
  };
}

// ========== 4. 默认配置 ==========

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  tradingEnabled: true,
  newOrdersEnabled: true,
  withdrawEnabled: true,
  maxConcurrentOrders: 100,
  maxOrdersPerMinute: 60,
  minOrderAmountUsdt: 5,
  maxOrderAmountUsdt: 100000,
  supportedExchanges: ['binance', 'okx', 'bybit'],
  allowedSymbols: [],
  blockedSymbols: [],
  marketStatus: {
    volatilityCheckEnabled: true,
    maxVolatility24h: 50,
    volatilityCheckInterval: 60,
    liquidityCheckEnabled: false,
    minOrderBookDepth: 10000,
    extremeMarketProtection: true,
    priceDeviationThreshold: 5,
  },
  circuitBreaker: {
    enabled: true,
    maxConsecutiveFailures: 5,
    failureWindowSeconds: 300,
    errorRateThreshold: 30,
    errorRateWindowSeconds: 60,
    minRequestsForErrorRate: 10,
    cooldownSeconds: 60,
    halfOpenRequests: 3,
  },
  maintenanceMode: false,
};

export const DEFAULT_USER_RISK_CONFIG: UserRiskConfig = {
  maxOpenPositions: 5,
  maxPositionsPerSymbol: 1,
  maxTotalExposureUsdt: 10000,
  maxSingleOrderUsdt: 1000,
  minSingleOrderUsdt: 10,
  maxDailyTrades: 50,
  maxDailyLossUsdt: 500,
  maxDailyLossPercent: 10,
  maxDrawdownPercent: 20,
  drawdownWindowDays: 30,
  pauseOnMaxDrawdown: true,
  maxLeverage: 10,
  defaultLeverage: 1,
  allowedSymbols: [],
  blockedSymbols: [],
};

export const DEFAULT_USER_FUND_CONFIG: UserFundConfig = {
  allocationStrategy: 'fixed',
  fixedAmountUsdt: 100,
  reserveBalanceUsdt: 50,
  reserveBalancePercent: 10,
  compoundEnabled: false,
  compoundThreshold: 1000,
  reduceAfterLoss: false,
  lossReductionPercent: 20,
  lossRecoveryTrades: 3,
};

export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  orderType: 'market',
  slippage: {
    tolerancePercent: 0.5,
    checkEnabled: true,
    maxAcceptablePercent: 1.0,
  },
  retry: {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
    retryOnErrors: ['ETIMEDOUT', 'ECONNRESET', 'NetworkError'],
  },
  timeout: {
    orderPlacementMs: 10000,
    orderConfirmationMs: 30000,
    positionCheckMs: 5000,
  },
  concurrency: {
    maxConcurrentOrders: 3,
    orderIntervalMs: 100,
  },
};

export const DEFAULT_POSITION_CONFIG: PositionConfig = {
  entry: {
    amountType: 'fixed',
    fixedAmountUsdt: 100,
    maxAmountUsdt: 1000,
    scaling: {
      enabled: false,
      steps: 1,
      intervalSeconds: 0,
    },
  },
  pyramiding: {
    enabled: false,
    maxAdds: 0,
    addCondition: 'profit',
    addThresholdPercent: 5,
    addAmountPercent: 50,
  },
  exit: {
    autoCloseOnSignal: true,
    partialCloseEnabled: false,
    scaling: {
      enabled: false,
      steps: 1,
      percentPerStep: [100],
    },
  },
  maxPositions: 3,
  allowSameSymbol: false,
};

export const DEFAULT_RISK_MANAGEMENT_CONFIG: RiskManagementConfig = {
  stopLoss: {
    enabled: false,
    type: 'fixed',
    fixedPercent: 5,
  },
  takeProfit: {
    enabled: false,
    type: 'fixed',
    fixedPercent: 10,
  },
  timeBasedExit: {
    enabled: false,
    maxHoldingHours: 24,
    exitIfNotProfitable: true,
  },
  riskReward: {
    checkEnabled: false,
    minRatio: 1.5,
  },
};

export const DEFAULT_SIGNAL_HANDLING_CONFIG: SignalHandlingConfig = {
  filter: {
    allowedSides: ['buy', 'sell'],
  },
  validity: {
    maxAgeSeconds: 60,
    priceDeviationPercent: 1,
  },
  confirmation: {
    requireManual: false,
    autoConfirmBelow: 1000,
    confirmationTimeoutSeconds: 300,
  },
  conflict: {
    onOppositeSignal: 'close_only',
    onSameDirectionSignal: 'ignore',
  },
  queue: {
    maxPendingSignals: 10,
    processingOrder: 'fifo',
  },
};
