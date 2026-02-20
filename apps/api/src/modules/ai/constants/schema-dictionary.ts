/**
 * 数据字典 — 移植自 NoFx kernel/schema.go
 *
 * 提供双语字段定义、交易规则、OI 解读、常见错误，
 * 让 AI 100% 理解输入数据的含义，输出更高质量的决策。
 *
 * 仅供产品 B（ai_strategy 自动交易）Prompt 注入使用。
 */

// ========================= 版本 =========================

export const SCHEMA_VERSION = '1.0.0';

// ========================= 语言 =========================

export type SchemaLang = 'zh-CN' | 'en-US';

// ========================= 双语字段定义 =========================

export interface BilingualFieldDef {
  nameZH: string;
  nameEN: string;
  unit: string;
  formulaZH?: string;
  formulaEN?: string;
  descZH: string;
  descEN: string;
}

/** 获取字段名称 */
function getName(f: BilingualFieldDef, lang: SchemaLang): string {
  return lang === 'zh-CN' ? f.nameZH : f.nameEN;
}

/** 获取公式 */
function getFormula(f: BilingualFieldDef, lang: SchemaLang): string {
  return lang === 'zh-CN' ? (f.formulaZH ?? '') : (f.formulaEN ?? '');
}

/** 获取描述 */
function getDesc(f: BilingualFieldDef, lang: SchemaLang): string {
  return lang === 'zh-CN' ? f.descZH : f.descEN;
}

// ========================= 数据字典 =========================

export const DataDictionary: Record<string, Record<string, BilingualFieldDef>> = {
  AccountMetrics: {
    Equity: {
      nameZH: '总权益',
      nameEN: 'Total Equity',
      unit: 'USDT',
      formulaZH: '可用余额 + 未实现盈亏',
      formulaEN: 'Available Balance + Unrealized PnL',
      descZH: '账户的实际净值，包含所有持仓的浮动盈亏',
      descEN: 'Actual account value including all unrealized P&L from positions',
    },
    Balance: {
      nameZH: '可用余额',
      nameEN: 'Available Balance',
      unit: 'USDT',
      formulaZH: '初始资金 + 已实现盈亏',
      formulaEN: 'Initial Capital + Realized PnL',
      descZH: '可用于开新仓位的资金，不包括已用保证金',
      descEN: 'Available funds for opening new positions, excluding used margin',
    },
    PnL: {
      nameZH: '总盈亏百分比',
      nameEN: 'Total PnL Percentage',
      unit: '%',
      formulaZH: '(总权益 - 初始资金) / 初始资金 × 100',
      formulaEN: '(Total Equity - Initial Capital) / Initial Capital × 100',
      descZH: '自系统启动以来的总收益率，+15.87%表示盈利15.87%',
      descEN: 'Total return since inception, +15.87% means 15.87% profit',
    },
    Margin: {
      nameZH: '保证金使用率',
      nameEN: 'Margin Usage Rate',
      unit: '%',
      formulaZH: '已用保证金合计 / 总权益 × 100',
      formulaEN: 'Total Used Margin / Total Equity × 100',
      descZH: '该值越高，账户风险越大。安全值<30%，危险值>70%',
      descEN: 'Higher value = higher risk. Safe <30%, Dangerous >70%',
    },
  },

  TradeMetrics: {
    Entry: {
      nameZH: '进场价',
      nameEN: 'Entry Price',
      unit: 'USDT',
      descZH: '开仓时的平均价格',
      descEN: 'Average price when opening position',
    },
    Exit: {
      nameZH: '出场价',
      nameEN: 'Exit Price',
      unit: 'USDT',
      descZH: '平仓时的平均价格',
      descEN: 'Average price when closing position',
    },
    Profit: {
      nameZH: '已实现盈亏',
      nameEN: 'Realized PnL',
      unit: 'USDT',
      formulaZH: '(出场价 - 进场价) / 进场价 × 杠杆 × 仓位价值',
      formulaEN: '(Exit Price - Entry Price) / Entry Price × Leverage × Position Value',
      descZH: '已平仓交易的实际盈亏，包含手续费。正值=盈利，负值=亏损',
      descEN: 'Actual profit/loss of closed trades including fees. Positive=profit, Negative=loss',
    },
    'PnL%': {
      nameZH: '盈亏百分比',
      nameEN: 'PnL Percentage',
      unit: '%',
      formulaZH: '(出场价 - 进场价) / 进场价 × 杠杆 × 100',
      formulaEN: '(Exit - Entry) / Entry × Leverage × 100',
      descZH: '已平仓交易的收益率，+6.71%表示盈利6.71%',
      descEN: 'Return on closed trade, +6.71% means 6.71% profit',
    },
    HoldDuration: {
      nameZH: '持仓时长',
      nameEN: 'Holding Duration',
      unit: 'minutes',
      descZH: '从开仓到平仓的时间。<15分钟=超短线，15分钟-4小时=日内，>4小时=波段',
      descEN: 'Time from open to close. <15min=scalping, 15min-4h=intraday, >4h=swing',
    },
  },

  PositionMetrics: {
    'UnrealizedPnL%': {
      nameZH: '未实现盈亏百分比',
      nameEN: 'Unrealized PnL Percentage',
      unit: '%',
      formulaZH: '(当前价 - 进场价) / 进场价 × 杠杆 × 100',
      formulaEN: '(Current Price - Entry Price) / Entry Price × Leverage × 100',
      descZH: '当前持仓的浮动盈亏，未平仓前是浮动的',
      descEN: 'Floating P&L of current position, not realized until closed',
    },
    'PeakPnL%': {
      nameZH: '峰值盈亏百分比',
      nameEN: 'Peak PnL Percentage',
      unit: '%',
      descZH: '该持仓曾经达到的最高未实现盈亏。用于判断是否需要止盈',
      descEN: 'Historical max unrealized PnL for this position. Used for take-profit decisions',
    },
    Drawdown: {
      nameZH: '从峰值回撤',
      nameEN: 'Drawdown from Peak',
      unit: '%',
      formulaZH: '当前盈亏% - 峰值盈亏%',
      formulaEN: 'Current PnL% - Peak PnL%',
      descZH: '负值表示正在回撤。例如：峰值+5%，当前+3%，回撤=-2%',
      descEN: 'Negative = pulling back. E.g., Peak +5%, Current +3%, Drawdown = -2%',
    },
    Leverage: {
      nameZH: '杠杆倍数',
      nameEN: 'Leverage',
      unit: 'x',
      descZH: '3x表示价格变动1%，持仓盈亏变动3%。杠杆越高，风险越大',
      descEN: '3x means 1% price move = 3% position PnL. Higher leverage = higher risk',
    },
    Margin: {
      nameZH: '占用保证金',
      nameEN: 'Margin Used',
      unit: 'USDT',
      formulaZH: '仓位价值 / 杠杆',
      formulaEN: 'Position Value / Leverage',
      descZH: '该仓位锁定的保证金金额',
      descEN: 'Collateral locked for this position',
    },
    LiqPrice: {
      nameZH: '强平价格',
      nameEN: 'Liquidation Price',
      unit: 'USDT',
      descZH: '价格触及此值时会被强制平仓。0.0000表示无爆仓风险',
      descEN: 'Price at which position will be force-closed. 0.0000 = no liquidation risk',
    },
  },

  MarketData: {
    Volume: {
      nameZH: '成交量',
      nameEN: 'Volume',
      unit: 'base asset',
      descZH: '该时间段的交易量',
      descEN: 'Trading volume in this period',
    },
    OI: {
      nameZH: '持仓量',
      nameEN: 'Open Interest',
      unit: 'USDT',
      descZH: '未平仓合约的总价值。持仓量增加=资金流入，减少=资金流出',
      descEN: 'Total value of open contracts. Increasing OI = capital inflow, decreasing = outflow',
    },
    OIChange: {
      nameZH: '持仓量变化',
      nameEN: 'OI Change',
      unit: 'USDT & %',
      descZH: '1小时内持仓量的变化。用于判断市场真实资金流向',
      descEN: 'OI change in 1 hour. Used to determine real capital flow direction',
    },
  },
};

// ========================= 双语规则定义 =========================

export interface BilingualRuleDef {
  value: number | boolean | Record<string, unknown> | Array<Record<string, unknown>>;
  descZH: string;
  descEN: string;
  reasonZH: string;
  reasonEN: string;
}

// ========================= 交易规则 =========================

export const TradingRules = {
  RiskManagement: {
    MaxMarginUsage: {
      value: 0.3,
      descZH: '保证金使用率不得超过30%',
      descEN: 'Margin usage must not exceed 30%',
      reasonZH: '保留70%的资金应对极端行情和追加保证金',
      reasonEN: 'Reserve 70% capital for extreme market conditions and margin calls',
    },
    MaxPositionLoss: {
      value: -0.05,
      descZH: '单个持仓亏损达到-5%时必须止损',
      descEN: 'Must stop-loss when single position loss reaches -5%',
      reasonZH: '避免单笔交易造成过大损失',
      reasonEN: 'Prevent excessive loss from single trade',
    },
    MaxDailyLoss: {
      value: -0.1,
      descZH: '单日亏损达到-10%时停止交易',
      descEN: 'Stop trading when daily loss reaches -10%',
      reasonZH: '防止情绪化交易导致连续亏损',
      reasonEN: 'Prevent emotional trading leading to consecutive losses',
    },
    PositionSizeLimit: {
      value: 0.15,
      descZH: '单个仓位不得超过总权益的15%',
      descEN: 'Single position must not exceed 15% of total equity',
      reasonZH: '避免过度集中风险',
      reasonEN: 'Avoid excessive risk concentration',
    },
  } as Record<string, BilingualRuleDef>,

  EntrySignals: {
    VolumeSpike: {
      value: 2.0,
      descZH: '成交量是平均值的2倍以上时考虑进场',
      descEN: 'Consider entry when volume is 2x above average',
      reasonZH: '放量突破通常意味着强趋势',
      reasonEN: 'Volume breakout usually indicates strong trend',
    },
    OIChangeThreshold: {
      value: 0.02,
      descZH: '持仓量1小时内变化超过2%视为显著变化',
      descEN: 'OI change >2% in 1 hour is considered significant',
      reasonZH: '大额资金进出会导致持仓量显著变化',
      reasonEN: 'Large capital flows cause significant OI changes',
    },
  } as Record<string, BilingualRuleDef>,

  ExitSignals: {
    TrailingStop: {
      value: 0.3,
      descZH: '当盈亏从峰值回撤30%时平仓止盈',
      descEN: 'Close position when PnL pulls back 30% from peak',
      reasonZH: '锁定大部分利润，避免盈利回吐。例如：峰值+5%，回撤到+3.5%时平仓',
      reasonEN: 'Lock in most profits, avoid profit giveback. E.g., Peak +5%, close at +3.5%',
    },
    StopLoss: {
      value: -0.05,
      descZH: '硬止损设置在-5%',
      descEN: 'Hard stop-loss at -5%',
      reasonZH: '严格控制单笔最大损失',
      reasonEN: 'Strictly control maximum single-trade loss',
    },
  } as Record<string, BilingualRuleDef>,

  PositionControl: {
    ScaleIn: {
      value: { enabled: true, max_additions: 2, price_requirement: 0.01 },
      descZH: '只在盈利仓位上加仓，最多加2次，价格需比平均成本高1%',
      descEN: 'Only add to winning positions, max 2 additions, price must be 1% above avg cost',
      reasonZH: '顺势加仓，不追亏损',
      reasonEN: 'Add to winners, never average down losers',
    },
    ScaleOut: {
      value: [
        { pnl: 0.03, close_pct: 0.33 },
        { pnl: 0.05, close_pct: 0.5 },
        { pnl: 0.08, close_pct: 1.0 },
      ],
      descZH: '分批止盈：盈利3%时平33%，5%时平50%，8%时全平',
      descEN: 'Scale-out: Close 33% at +3%, 50% at +5%, 100% at +8%',
      reasonZH: '在保证利润的同时让盈利奔跑',
      reasonEN: 'Lock profits while letting winners run',
    },
  } as Record<string, BilingualRuleDef>,
};

// ========================= OI 解读 =========================

export const OIInterpretation = {
  OIUp_PriceUp: {
    zh: '强多头趋势（新多单开仓，资金流入做多）',
    en: 'Strong bullish trend (new longs opening, capital flowing into long positions)',
  },
  OIUp_PriceDown: {
    zh: '强空头趋势（新空单开仓，资金流入做空）',
    en: 'Strong bearish trend (new shorts opening, capital flowing into short positions)',
  },
  OIDown_PriceUp: {
    zh: '空头平仓（空头止损离场，可能出现反转）',
    en: 'Shorts covering (shorts stopped out, potential reversal)',
  },
  OIDown_PriceDown: {
    zh: '多头平仓（多头止损离场，可能出现反转）',
    en: 'Longs closing (longs stopped out, potential reversal)',
  },
};

// ========================= 常见错误 =========================

export interface CommonMistake {
  errorZH: string;
  errorEN: string;
  exampleZH: string;
  exampleEN: string;
  correctZH: string;
  correctEN: string;
}

export const CommonMistakes: CommonMistake[] = [
  {
    errorZH: '混淆已实现盈亏和未实现盈亏',
    errorEN: 'Confusing realized and unrealized P&L',
    exampleZH: '将历史交易的盈亏与当前持仓的盈亏相加',
    exampleEN: 'Adding historical trade P&L with current position P&L',
    correctZH: '已实现盈亏已经计入账户余额，不应重复计算',
    correctEN: 'Realized P&L is already included in account balance, don\'t double count',
  },
  {
    errorZH: '忽略杠杆对盈亏的影响',
    errorEN: 'Ignoring leverage\'s impact on P&L',
    exampleZH: '价格涨1%，认为盈利1%',
    exampleEN: 'Price up 1%, thinking profit is 1%',
    correctZH: '3x杠杆时，价格涨1%，实际盈利约3%',
    correctEN: 'With 3x leverage, 1% price move = ~3% P&L',
  },
  {
    errorZH: '不理解Peak PnL的重要性',
    errorEN: 'Not understanding Peak PnL\'s importance',
    exampleZH: '只关注当前PnL，不关注回撤',
    exampleEN: 'Only watching current PnL, ignoring drawdown',
    correctZH: '当前PnL接近Peak PnL时，应考虑止盈以锁定利润',
    correctEN: 'When current PnL near Peak PnL, consider taking profit to lock in gains',
  },
  {
    errorZH: '忽略持仓量(OI)变化',
    errorEN: 'Ignoring Open Interest changes',
    exampleZH: '只看价格K线，不看资金流向',
    exampleEN: 'Only watching price candles, not capital flows',
    correctZH: '结合OI变化判断趋势的真实性和持续性',
    correctEN: 'Use OI changes to validate trend authenticity and sustainability',
  },
];

// ========================= Schema 配置 =========================

export interface SchemaConfig {
  lang?: SchemaLang;
  /** 是否包含交易规则 */
  includeRules?: boolean;
  /** 是否包含 OI 解读 */
  includeOI?: boolean;
  /** 是否包含常见错误 */
  includeMistakes?: boolean;
}

// ========================= Prompt 生成 =========================

/**
 * 格式化单个字段定义（中文）
 */
function formatFieldZH(key: string, f: BilingualFieldDef): string {
  let line = `- **${key}**（${f.nameZH}）: ${f.descZH}`;
  if (f.formulaZH) line += ` | 公式: \`${f.formulaZH}\``;
  if (f.unit) line += ` | 单位: ${f.unit}`;
  return line + '\n';
}

/**
 * 格式化单个字段定义（英文）
 */
function formatFieldEN(key: string, f: BilingualFieldDef): string {
  let line = `- **${key}** (${f.nameEN}): ${f.descEN}`;
  if (f.formulaEN) line += ` | Formula: \`${f.formulaEN}\``;
  if (f.unit) line += ` | Unit: ${f.unit}`;
  return line + '\n';
}

/**
 * 格式化规则（中文）
 */
function formatRuleZH(key: string, r: BilingualRuleDef): string {
  return `- **${key}**: ${r.descZH}（原因: ${r.reasonZH}）\n`;
}

/**
 * 格式化规则（英文）
 */
function formatRuleEN(key: string, r: BilingualRuleDef): string {
  return `- **${key}**: ${r.descEN} (Reason: ${r.reasonEN})\n`;
}

/**
 * 生成完整的 Schema Prompt 文本
 *
 * 用于注入 System Prompt Section 0，让 AI 理解数据格式。
 */
export function getSchemaPrompt(config?: SchemaConfig): string {
  const lang: SchemaLang = config?.lang ?? 'en-US';
  const includeRules = config?.includeRules ?? true;
  const includeOI = config?.includeOI ?? true;
  const includeMistakes = config?.includeMistakes ?? true;

  if (lang === 'zh-CN') {
    return buildSchemaPromptZH(includeRules, includeOI, includeMistakes);
  }
  return buildSchemaPromptEN(includeRules, includeOI, includeMistakes);
}

// ── 中文版 ──

function buildSchemaPromptZH(
  includeRules: boolean,
  includeOI: boolean,
  includeMistakes: boolean,
): string {
  let p = `# 数据字典与交易规则 (v${SCHEMA_VERSION})\n\n`;
  p += '## 字段含义说明\n\n';

  // 账户指标
  p += '### 账户指标\n';
  for (const [key, field] of Object.entries(DataDictionary.AccountMetrics)) {
    p += formatFieldZH(key, field);
  }

  // 交易指标
  p += '\n### 交易指标\n';
  for (const [key, field] of Object.entries(DataDictionary.TradeMetrics)) {
    p += formatFieldZH(key, field);
  }

  // 持仓指标
  p += '\n### 持仓指标\n';
  for (const [key, field] of Object.entries(DataDictionary.PositionMetrics)) {
    p += formatFieldZH(key, field);
  }

  // 市场数据
  p += '\n### 市场数据\n';
  for (const [key, field] of Object.entries(DataDictionary.MarketData)) {
    p += formatFieldZH(key, field);
  }

  // OI 解读
  if (includeOI) {
    p += '\n## 持仓量(OI)变化解读\n\n';
    p += `- **OI增加 + 价格上涨**: ${OIInterpretation.OIUp_PriceUp.zh}\n`;
    p += `- **OI增加 + 价格下跌**: ${OIInterpretation.OIUp_PriceDown.zh}\n`;
    p += `- **OI减少 + 价格上涨**: ${OIInterpretation.OIDown_PriceUp.zh}\n`;
    p += `- **OI减少 + 价格下跌**: ${OIInterpretation.OIDown_PriceDown.zh}\n`;
  }

  // 交易规则
  if (includeRules) {
    p += '\n## 交易规则\n\n';

    p += '### 风险管理\n';
    for (const [key, rule] of Object.entries(TradingRules.RiskManagement)) {
      p += formatRuleZH(key, rule);
    }

    p += '\n### 进场信号\n';
    for (const [key, rule] of Object.entries(TradingRules.EntrySignals)) {
      p += formatRuleZH(key, rule);
    }

    p += '\n### 出场信号\n';
    for (const [key, rule] of Object.entries(TradingRules.ExitSignals)) {
      p += formatRuleZH(key, rule);
    }

    p += '\n### 仓位控制\n';
    for (const [key, rule] of Object.entries(TradingRules.PositionControl)) {
      p += formatRuleZH(key, rule);
    }
  }

  // 常见错误
  if (includeMistakes) {
    p += '\n## 常见错误（请避免）\n\n';
    CommonMistakes.forEach((m, i) => {
      p += `${i + 1}. **${m.errorZH}**\n`;
      p += `   - 错误示例: ${m.exampleZH}\n`;
      p += `   - 正确做法: ${m.correctZH}\n`;
    });
  }

  return p;
}

// ── 英文版 ──

function buildSchemaPromptEN(
  includeRules: boolean,
  includeOI: boolean,
  includeMistakes: boolean,
): string {
  let p = `# Data Dictionary & Trading Rules (v${SCHEMA_VERSION})\n\n`;
  p += '## Field Definitions\n\n';

  // Account Metrics
  p += '### Account Metrics\n';
  for (const [key, field] of Object.entries(DataDictionary.AccountMetrics)) {
    p += formatFieldEN(key, field);
  }

  // Trade Metrics
  p += '\n### Trade Metrics\n';
  for (const [key, field] of Object.entries(DataDictionary.TradeMetrics)) {
    p += formatFieldEN(key, field);
  }

  // Position Metrics
  p += '\n### Position Metrics\n';
  for (const [key, field] of Object.entries(DataDictionary.PositionMetrics)) {
    p += formatFieldEN(key, field);
  }

  // Market Data
  p += '\n### Market Data\n';
  for (const [key, field] of Object.entries(DataDictionary.MarketData)) {
    p += formatFieldEN(key, field);
  }

  // OI Interpretation
  if (includeOI) {
    p += '\n## Open Interest (OI) Change Interpretation\n\n';
    p += `- **OI Up + Price Up**: ${OIInterpretation.OIUp_PriceUp.en}\n`;
    p += `- **OI Up + Price Down**: ${OIInterpretation.OIUp_PriceDown.en}\n`;
    p += `- **OI Down + Price Up**: ${OIInterpretation.OIDown_PriceUp.en}\n`;
    p += `- **OI Down + Price Down**: ${OIInterpretation.OIDown_PriceDown.en}\n`;
  }

  // Trading Rules
  if (includeRules) {
    p += '\n## Trading Rules\n\n';

    p += '### Risk Management\n';
    for (const [key, rule] of Object.entries(TradingRules.RiskManagement)) {
      p += formatRuleEN(key, rule);
    }

    p += '\n### Entry Signals\n';
    for (const [key, rule] of Object.entries(TradingRules.EntrySignals)) {
      p += formatRuleEN(key, rule);
    }

    p += '\n### Exit Signals\n';
    for (const [key, rule] of Object.entries(TradingRules.ExitSignals)) {
      p += formatRuleEN(key, rule);
    }

    p += '\n### Position Control\n';
    for (const [key, rule] of Object.entries(TradingRules.PositionControl)) {
      p += formatRuleEN(key, rule);
    }
  }

  // Common Mistakes
  if (includeMistakes) {
    p += '\n## Common Mistakes (Avoid These)\n\n';
    CommonMistakes.forEach((m, i) => {
      p += `${i + 1}. **${m.errorEN}**\n`;
      p += `   - Wrong: ${m.exampleEN}\n`;
      p += `   - Correct: ${m.correctEN}\n`;
    });
  }

  return p;
}
