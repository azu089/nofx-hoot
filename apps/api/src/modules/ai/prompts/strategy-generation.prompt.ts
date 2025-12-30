/**
 * AI 策略生成 Prompt 模板
 */
export const STRATEGY_GENERATION_PROMPT = (
  description: string,
  riskLevel: 'low' | 'medium' | 'high',
  tradingPair?: string,
): string => {
  const riskConfig = {
    low: { stoploss: -0.05, roi: 0.03, maxTrades: 3 },
    medium: { stoploss: -0.10, roi: 0.05, maxTrades: 5 },
    high: { stoploss: -0.15, roi: 0.10, maxTrades: 10 },
  };

  const config = riskConfig[riskLevel];

  return `
你是一位专业的量化交易策略开发专家，请根据以下需求生成一个 Freqtrade 策略（Python 代码）。

**用户需求：**
${description}

**风险等级：** ${riskLevel}
**交易对：** ${tradingPair || '通用（多币种）'}

**技术要求：**
1. 基于 Freqtrade IStrategy 接口
2. 包含 populate_indicators、populate_entry_trend、populate_exit_trend 方法
3. 使用常见技术指标（如 EMA/RSI/MACD/Bollinger Bands）
4. 建议配置：
   - stoploss: ${config.stoploss}
   - minimal_roi: 0.01, 0.02, 0.03...
   - max_open_trades: ${config.maxTrades}
   - trailing_stop: ${riskLevel === 'low' ? 'false' : 'true'}

**安全限制（必须遵守）：**
- 禁止使用 os.system() / subprocess / exec() / eval() 等危险函数
- 禁止文件操作（读写/删除）
- 禁止网络请求（除了 ccxt 交易所 API）
- 只能使用 pandas、ta-lib、numpy、ccxt 等允许的库

**输出格式：**
请返回一个 JSON 对象，包含以下字段：
\`\`\`json
{
  "strategyCode": "完整的 Python 策略代码，不要包含 markdown 格式",
  "explanation": "策略逻辑的中文解释（2-3 段）",
  "suggestedConfig": {
    "stake_amount": 100,
    "stoploss": ${config.stoploss},
    "trailing_stop": ${riskLevel === 'low' ? false : true},
    "max_open_trades": ${config.maxTrades}
  }
}
\`\`\`

请确保返回的是纯 JSON，不要包含任何 markdown 格式或额外的解释。
`;
};
