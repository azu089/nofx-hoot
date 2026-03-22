/**
 * 数据字典 — AI 自动交易数据格式与规则
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
      descZH: '该值越高，账户风险越大。系统在开仓时自动控制保证金上限，不需要因保证金使用率高而主动平仓',
      descEN: 'Higher = riskier. System auto-controls margin at entry — do NOT close positions due to high margin usage',
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
    FundingRate: {
      nameZH: '资金费率',
      nameEN: 'Funding Rate',
      unit: '%/8h',
      descZH: '正值=多头付费给空头(看跌信号)，负值=空头付费给多头(看涨信号)。方向很重要，不要只看绝对值',
      descEN: 'Positive=longs pay shorts(bearish), Negative=shorts pay longs(bullish). Direction matters, never use |FR| alone',
    },
    MarketRegime: {
      nameZH: '市场状态',
      nameEN: 'Market Regime',
      unit: '',
      descZH: 'ATR14/Price标准化: dead(<0.3%), ranging(0.3-1.5%), trending(1.5-3.5%), volatile(>3.5%)',
      descEN: 'ATR14/Price normalized: dead(<0.3%), ranging(0.3-1.5%), trending(1.5-3.5%), volatile(>3.5%)',
    },
    LongShortRatio: {
      nameZH: '多空账户比',
      nameEN: 'Long/Short Account Ratio',
      unit: 'ratio',
      descZH: '>1表示多头账户多于空头（偏多），<1表示空头多于多头（偏空）。反映散户持仓情绪',
      descEN: '>1 = more long accounts than short (bullish bias), <1 = more shorts (bearish). Reflects retail sentiment',
    },
    TakerBuySell: {
      nameZH: '主动买卖比',
      nameEN: 'Taker Buy/Sell Ratio',
      unit: 'ratio',
      descZH: '>1表示主动买入量大于卖出（买方激进），<1表示主动卖出更多（卖方激进）',
      descEN: '>1 = aggressive buyers dominate, <1 = aggressive sellers dominate. Leading indicator of short-term direction',
    },
    LiquidationData: {
      nameZH: '清算数据',
      nameEN: 'Liquidation Data',
      unit: 'USD',
      descZH: '24h清算总额及多空分布。清算密集区=强支撑/阻力。多头清算多=下方有抛压，空头清算多=上方有轧空',
      descEN: '24h liquidation totals by side. Dense zones = strong S/R. High long liq = selling pressure below, high short liq = squeeze potential above',
    },
    PutCallRatio: {
      nameZH: '看跌/看涨比',
      nameEN: 'Put/Call Ratio',
      unit: 'ratio',
      descZH: '<0.7偏多（市场乐观），>1.3偏空（市场恐惧）。Max Pain=最多期权归零的价格，是短期磁吸位',
      descEN: '<0.7 bullish (optimism), >1.3 bearish (fear). Max Pain = price where most options expire worthless, acts as short-term magnet',
    },
    StablecoinFlow: {
      nameZH: '稳定币资金流',
      nameEN: 'Stablecoin Fund Flow',
      unit: 'USD',
      descZH: '稳定币净铸造量。正值=新资金流入加密市场（看涨），负值=资金流出（看跌）。领先指标',
      descEN: 'Net stablecoin minted. Positive = new capital entering crypto (bullish), Negative = capital leaving (bearish). Leading indicator',
    },
    ETFFlow: {
      nameZH: 'ETF资金流',
      nameEN: 'ETF Fund Flow',
      unit: 'USD',
      descZH: 'BTC/ETH ETF每日净流入。正值=机构买入（看涨），负值=机构卖出（看跌）。反映机构情绪',
      descEN: 'BTC/ETH ETF daily net flow. Positive = institutional buying (bullish), Negative = selling (bearish). Reflects institutional sentiment',
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
    // MaxMarginUsage 已删除（对齐 nofx：保证金使用率仅信息展示，位置价值比才是硬约束）
    MaxPositionLoss: {
      value: -0.05,
      descZH: '单仓止损距离 = max(1.5×ATR14/Price, baseRisk/leverage)，杠杆自适应',
      descEN: 'Stop loss distance = max(1.5×ATR14/Price, baseRisk/leverage), leverage-adaptive',
      reasonZH: '高杠杆时止损更紧，低杠杆时止损更宽，匹配实际风险',
      reasonEN: 'Tighter SL with higher leverage, wider SL with lower leverage, matching actual risk',
    },
    MaxDailyLoss: {
      value: -0.1,
      descZH: '单日亏损达到-10%时停止交易',
      descEN: 'Stop trading when daily loss reaches -10%',
      reasonZH: '防止情绪化交易导致连续亏损',
      reasonEN: 'Prevent emotional trading leading to consecutive losses',
    },
    // PositionSizeLimit 已删除（对齐 nofx：由位置价值比 Position Value Ratio 在代码层控制，非 prompt 硬约束）
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
      descZH: '仅在 PeakPnL ≥ 2% 时启用: 盈亏从峰值回撤30%时平仓止盈',
      descEN: 'Only when PeakPnL ≥ 2%: Close when PnL pulls back 30% from peak',
      reasonZH: '峰值不足2%时波动是正常的。例如：峰值+5%回撤到+3.5%时平仓；峰值+0.5%时忽略回撤',
      reasonEN: 'Small peaks are normal noise. E.g., Peak +5% close at +3.5%; Peak +0.5% ignore drawdown',
    },
    StopLoss: {
      value: -0.05,
      descZH: '止损距离 = max(1.5×ATR14/Price, baseRisk/leverage)，杠杆自适应',
      descEN: 'SL distance = max(1.5×ATR14/Price, baseRisk/leverage), leverage-adaptive',
      reasonZH: '高杠杆配窄止损，低杠杆配宽止损。5x杠杆+2%ATR → SL=max(3%,2%/5)=3%',
      reasonEN: 'Higher leverage → tighter SL. 5x leverage + 2% ATR → SL=max(3%,2%/5)=3%',
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
        { atr_mult: 1.5, close_pct: 0.33 },
        { atr_mult: 2.5, close_pct: 0.5 },
        { atr_mult: 4.0, close_pct: 1.0 },
      ],
      descZH: '分批止盈(ATR倍数): +1.5×ATR平33%，+2.5×ATR平50%，+4×ATR全平',
      descEN: 'Scale-out (ATR-based): Close 33% at +1.5×ATR, 50% at +2.5×ATR, 100% at +4×ATR',
      reasonZH: 'ATR适配不同币种波动率，BTC和SOL用不同绝对距离',
      reasonEN: 'ATR adapts to each asset\'s volatility, different absolute distances for BTC vs SOL',
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
