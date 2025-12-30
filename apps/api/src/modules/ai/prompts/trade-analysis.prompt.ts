/**
 * AI 交易分析 Prompt 模板
 */
export const TRADE_ANALYSIS_PROMPT = (
  trades: any[],
  timeRange: string,
): string => {
  // 统计数据
  const totalTrades = trades.length;
  const winningTrades = trades.filter((t) => (t.pnl || 0) > 0).length;
  const losingTrades = trades.filter((t) => (t.pnl || 0) < 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const totalPnl = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);

  // 提取部分交易详情（最多 20 笔）
  const sampleTrades = trades.slice(0, 20).map((t) => ({
    symbol: t.symbol,
    side: t.side,
    pnl: t.pnl,
    pnl_percentage: t.pnl_percentage,
    opened_at: t.opened_at,
    closed_at: t.closed_at,
  }));

  return `
你是一位专业的量化交易分析师，请分析以下用户的交易数据。

**时间范围：** 最近 ${timeRange}
**交易总数：** ${totalTrades}
**胜率：** ${winRate.toFixed(2)}%
**总盈亏：** ${totalPnl.toFixed(2)} USDT

**交易样本（前 20 笔）：**
\`\`\`json
${JSON.stringify(sampleTrades, null, 2)}
\`\`\`

**分析要求：**
1. 识别交易模式（高频/低频、持仓时间、盈亏分布）
2. 评估风险控制（止损执行、最大回撤）
3. 情绪分析（是否存在追涨杀跌、FOMO、过度交易等）
4. 提供 3-5 条具体改进建议

**输出格式：**
请返回一个 JSON 对象，包含以下字段：
\`\`\`json
{
  "summary": "交易分析总结（100-200 字）",
  "strengths": ["优势1", "优势2", "优势3"],
  "weaknesses": ["不足1", "不足2", "不足3"],
  "suggestions": ["建议1", "建议2", "建议3"],
  "emotionScore": 75,
  "riskLevel": "medium"
}
\`\`\`

**emotionScore 评分标准（0-100）：**
- 0-30: 极度恐惧/贪婪，情绪化交易严重
- 31-60: 存在一定情绪波动
- 61-80: 基本理性
- 81-100: 高度纪律性

**riskLevel 评级标准：**
- low: 风险控制良好，止损严格
- medium: 风险可控，偶有失误
- high: 风险较高，频繁爆仓或大额亏损

请确保返回的是纯 JSON，不要包含任何 markdown 格式或额外的解释。
`;
};
