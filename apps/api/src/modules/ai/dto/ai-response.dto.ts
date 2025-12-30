/**
 * AI 策略生成响应 DTO
 */
export class GenerateStrategyResponseDto {
  strategyCode: string; // 生成的 Python 策略代码
  explanation: string; // 策略解释
  suggestedConfig: {
    stake_amount?: number;
    stoploss?: number;
    trailing_stop?: boolean;
    max_open_trades?: number;
  }; // 建议配置
  tokensUsed?: number; // 消耗的 Token 数量
  generationId: string; // 生成记录 ID
}

/**
 * 交易分析响应 DTO
 */
export class AnalyzeTradesResponseDto {
  summary: string; // 分析总结
  strengths: string[]; // 优势
  weaknesses: string[]; // 不足
  suggestions: string[]; // 改进建议
  emotionScore: number; // 情绪得分 (0-100)
  riskLevel: 'low' | 'medium' | 'high'; // 风险等级
  tokensUsed?: number; // 消耗的 Token 数量
  analysisId: string; // 分析记录 ID
}

/**
 * 配额信息响应 DTO
 */
export class QuotaInfoResponseDto {
  vipLevel: number; // VIP 等级
  monthlyQuota: number | 'unlimited'; // 月度配额
  usedThisMonth: number; // 本月已使用
  remainingQuota: number | 'unlimited'; // 剩余配额
}

/**
 * AI 生成历史记录 DTO
 */
export class AiGenerationHistoryDto {
  id: string;
  type: 'strategy' | 'analysis';
  input: string;
  output: string;
  tokensUsed?: number;
  model?: string;
  createdAt: Date;
}
