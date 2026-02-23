import { Injectable, Logger, Optional } from '@nestjs/common';
import { LLMService, UserApiKeys } from '../llm.service';
import { AiMemoryService } from '../memory.service';
import { buildLanguageInstruction, buildUserMessageLanguageReminder, buildReasoningLanguageHint } from '../../constants/locale-instructions';
import { AiAction, RiskDebateState } from '../../types/ai.types';

/**
 * 风控辩论配置
 */
export interface RiskDebateConfig {
  maxRounds: number; // 每个角色的发言轮数（默认 1 → 3 条消息）
  deepThinkModel: string; // 法官使用的 deep_think 模型
  quickThinkModel: string; // 辩论者使用的 quick_think 模型
  apiKeys: UserApiKeys;
  temperature?: number;
  userId?: string;     // Q3: 用于 BM25 记忆检索
  sceneText?: string;  // Q3: 当前市场场景（BM25 查询文本）
  locale?: string;     // AI 输出语言
}

/**
 * 风控辩论输入
 */
export interface RiskDebateInput {
  symbol: string;
  currentPrice: number;
  traderPlan: string; // Stage 3 交易员提案
  analystReports: string; // Stage 1 分析师报告汇总
  investmentDecision: string; // Stage 2 投资辩论裁决
  existingPositions?: string; // 现有持仓描述
  additionalSymbolData?: string; // Phase 9.0 T4: 多币种辩论额外候选币提案
}

/**
 * 风控调整结果
 */
export interface RiskDebateResult {
  adjustedLeverage: number | null;
  adjustedPositionSizePercent: number | null;
  adjustedStopLoss: number | null;
  adjustedTakeProfit: number | null;
  // R5: Risk Judge 可覆盖交易方向（null=保持原方向, 'hold'/'wait'=推翻为不交易）
  adjustedAction?: AiAction | null;
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  approved: boolean; // 是否通过风控
  reasoning: string;
  fullDebateHistory: string;
  totalCost: number;
  totalLatencyMs: number;
}

/**
 * 风控三方辩论服务
 *
 * 对应 TradingAgents 第 4 阶段: 风控三方辩论
 *
 * 3 个辩论角色:
 * 1. Aggressive — 支持高风险高回报，质疑保守策略
 * 2. Conservative — 强调资本保护，强调下行风险
 * 3. Neutral — 平衡视角，挑战双方极端
 *
 * + Risk Judge (deep_think 模型) 做最终裁决
 *
 * 轮转: Aggressive → Conservative → Neutral → 重复
 * 总消息数 = 3 × maxRounds
 */
@Injectable()
export class RiskDebateService {
  private readonly logger = new Logger(RiskDebateService.name);

  constructor(
    private readonly llm: LLMService,
    @Optional() private readonly memoryService?: AiMemoryService,
  ) {}

  /**
   * Y7: LLM 调用超时包装（60s debate 级别防护）
   */
  private async chatWithTimeout(
    modelId: string,
    systemPrompt: string,
    userMessage: string,
    apiKeys: UserApiKeys,
    options: { temperature?: number; maxTokens?: number },
    timeoutMs: number = 60000,
  ): Promise<Awaited<ReturnType<LLMService['chat']>>> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`LLM call timeout (${timeoutMs}ms)`)), timeoutMs),
    );
    return Promise.race([
      this.llm.chat(modelId, systemPrompt, userMessage, apiKeys, options),
      timeoutPromise,
    ]);
  }

  /**
   * 运行风控三方辩论
   */
  async runRiskDebate(
    input: RiskDebateInput,
    config: RiskDebateConfig,
  ): Promise<RiskDebateResult> {
    const startTime = Date.now();
    const maxMessages = 3 * config.maxRounds; // 每轮 3 条消息

    this.logger.log(
      `[风控辩论] 开始: ${input.symbol}, ${config.maxRounds} 轮 (${maxMessages} 条消息)`,
    );

    // 初始化辩论状态
    const state: RiskDebateState = {
      aggressiveHistory: '',
      conservativeHistory: '',
      neutralHistory: '',
      fullHistory: '',
      latestSpeaker: 'judge', // 尚未开始
      count: 0,
    };

    let totalCost = 0;

    // 轮转: aggressive → conservative → neutral → aggressive → ...
    const speakerOrder: Array<'aggressive' | 'conservative' | 'neutral'> = [
      'aggressive',
      'conservative',
      'neutral',
    ];

    for (let i = 0; i < maxMessages; i++) {
      const speaker = speakerOrder[i % 3];
      const roundNum = Math.floor(i / 3) + 1;
      const isFirst = i < 3; // 第一轮各角色独立发言

      this.logger.log(`[风控辩论] 第 ${roundNum} 轮, ${speaker} 发言 (${i + 1}/${maxMessages})`);

      const systemPrompt = this.getSpeakerPrompt(speaker, config.locale);
      const userMessage = this.buildSpeakerMessage(
        speaker,
        input,
        state,
        isFirst,
        roundNum,
        config.maxRounds,
        config.locale,
      );

      // Y7: 60s 超时防护
      const response = await this.chatWithTimeout(
        config.quickThinkModel,
        systemPrompt,
        userMessage,
        config.apiKeys,
        {
          temperature: config.temperature ?? 0.6,
          maxTokens: 600,
        },
      );

      totalCost += response.cost;

      // NoFx-aligned 详细日志: 角色观点预览
      const riskPreview = response.content.slice(0, 200);
      this.logger.log(
        `[风控辩论] ${speaker} (Round ${roundNum}): tokens=${response.tokenUsage} 耗时=${response.latencyMs}ms\n` +
        `  观点: ${riskPreview}${riskPreview.length >= 200 ? '...' : ''}`,
      );

      // 更新状态
      const entry = `\n[${speaker.toUpperCase()} - Round ${roundNum}]:\n${response.content}\n`;
      state.fullHistory += entry;

      // 防止 fullHistory 超过 LLM context window（保留最近的内容）
      if (state.fullHistory.length > 20000) {
        state.fullHistory = '...[earlier debate truncated]...\n' + state.fullHistory.slice(-16000);
      }
      state.latestSpeaker = speaker;
      state.count = i + 1;

      switch (speaker) {
        case 'aggressive':
          state.aggressiveHistory += entry;
          break;
        case 'conservative':
          state.conservativeHistory += entry;
          break;
        case 'neutral':
          state.neutralHistory += entry;
          break;
      }
    }

    // Q3: 检索 BM25 记忆注入 Risk Judge
    let judgeMemoryPrompt = '';
    if (this.memoryService && config.userId && config.sceneText) {
      try {
        const memories = await this.memoryService.retrieveSimilar(
          config.sceneText, config.userId, 2, 'risk_manager',
        );
        if (memories.length > 0) {
          judgeMemoryPrompt = '\n\n=== LEARN FROM PAST MISTAKES ===\n';
          for (const m of memories) {
            judgeMemoryPrompt += `Past decision: ${m.symbol} ${m.action} | `;
            judgeMemoryPrompt += `Result: ${m.isWin ? 'WIN' : 'LOSS'} ${m.pnlPercent ?? m.pnl ?? 0}%\n`;
            if (m.lesson) judgeMemoryPrompt += `Lesson: ${m.lesson}\n`;
            judgeMemoryPrompt += '\n';
          }
          judgeMemoryPrompt += 'Apply these lessons to your current risk assessment.\n';
          this.logger.log(`[风控辩论] BM25 记忆注入: ${memories.length} 条`);
        }
      } catch (err) {
        this.logger.warn(`[风控辩论] BM25 记忆检索失败: ${err.message}`);
      }
    }

    // 法官裁决（使用 deep_think 模型）
    this.logger.log('[风控辩论] Risk Judge 裁决...');
    const judgeResult = await this.runRiskJudge(input, state, config, judgeMemoryPrompt);
    totalCost += judgeResult.cost;

    const totalLatencyMs = Date.now() - startTime;

    this.logger.log(
      `[风控辩论] ======== 裁决结果 ========\n` +
      `  approved=${judgeResult.approved} risk=${judgeResult.riskRating}\n` +
      `  adjustedLeverage=${judgeResult.adjustedLeverage ?? 'unchanged'}\n` +
      `  adjustedPosPct=${judgeResult.adjustedPositionSizePercent ?? 'unchanged'}\n` +
      `  adjustedSL=${judgeResult.adjustedStopLoss ?? 'unchanged'} TP=${judgeResult.adjustedTakeProfit ?? 'unchanged'}\n` +
      `  adjustedAction=${(judgeResult as any).adjustedAction ?? 'unchanged'}\n` +
      `  reasoning=${(judgeResult.reasoning || '').slice(0, 200)}\n` +
      `  总耗时 ${totalLatencyMs}ms, 总成本 $${totalCost.toFixed(6)}`,
    );

    return {
      ...judgeResult,
      fullDebateHistory: state.fullHistory,
      totalCost,
      totalLatencyMs,
    };
  }

  // ==================== 角色提示词 ====================

  private getSpeakerPrompt(speaker: 'aggressive' | 'conservative' | 'neutral', locale?: string): string {
    const langInst = buildLanguageInstruction(locale);
    switch (speaker) {
      case 'aggressive':
        return AGGRESSIVE_PROMPT + '\n\n' + langInst;
      case 'conservative':
        return CONSERVATIVE_PROMPT + '\n\n' + langInst;
      case 'neutral':
        return NEUTRAL_PROMPT + '\n\n' + langInst;
    }
  }

  // ==================== 消息构建 ====================

  private buildSpeakerMessage(
    speaker: 'aggressive' | 'conservative' | 'neutral',
    input: RiskDebateInput,
    state: RiskDebateState,
    isFirst: boolean,
    roundNum: number,
    maxRounds: number,
    locale?: string,
  ): string {
    const lines: string[] = [
      `=== RISK DEBATE: ${input.symbol} @ ${input.currentPrice} ===`,
      '',
      '--- Trader Proposal ---',
      input.traderPlan,
      '',
      '--- Investment Decision ---',
      input.investmentDecision,
      '',
    ];

    if (input.existingPositions) {
      lines.push('--- Existing Positions ---');
      lines.push(input.existingPositions);
      lines.push('');
    }

    // Phase 9.0 T4: 多币种辩论注入额外候选币提案
    if (input.additionalSymbolData) {
      lines.push('--- Additional Candidate Coins ---');
      lines.push(input.additionalSymbolData);
      lines.push('');
    }

    // G4: 注入分析师报告摘要（对齐 TradingAgents: 风控辩论者看到分析师报告）
    // GAP-E: 放宽到 3000 字符，确保每个分析维度都有代表性内容
    if (input.analystReports) {
      lines.push('--- Analyst Reports Summary ---');
      lines.push(input.analystReports.slice(0, 3000));
      lines.push('');
    }

    if (isFirst) {
      lines.push(
        `This is Round ${roundNum} of ${maxRounds}. Give your initial risk assessment of the trader proposal above.`,
      );
    } else {
      lines.push('--- Previous Discussion ---');
      lines.push(state.fullHistory);
      lines.push('');

      if (roundNum === maxRounds) {
        lines.push(
          `This is the FINAL round (${roundNum}/${maxRounds}). Give your definitive risk assessment. ` +
            `Challenge the other perspectives one last time and state your final position.`,
        );
      } else {
        lines.push(
          `This is Round ${roundNum} of ${maxRounds}. ` +
            `Respond to the other risk assessors. Defend your position or adjust if convinced.`,
        );
      }
    }

    // 末尾追加语言提醒（防止英文上下文淹没 system prompt 的语言指令）
    const langReminder = buildUserMessageLanguageReminder(locale);
    return lines.join('\n') + langReminder;
  }

  // ==================== Risk Judge ====================

  private async runRiskJudge(
    input: RiskDebateInput,
    state: RiskDebateState,
    config: RiskDebateConfig,
    memoryPrompt: string = '',
  ): Promise<
    Omit<RiskDebateResult, 'fullDebateHistory' | 'totalCost' | 'totalLatencyMs'> & {
      cost: number;
    }
  > {
    // Q3: 注入 BM25 记忆到法官系统提示 + 语言指令
    const langInst = buildLanguageInstruction(config.locale);
    const systemPrompt = RISK_JUDGE_PROMPT + '\n\n' + langInst + memoryPrompt;

    const userMessage = `=== RISK JUDGE FINAL DECISION ===

Symbol: ${input.symbol}
Current Price: ${input.currentPrice}

--- Original Trader Proposal ---
${input.traderPlan}

--- Investment Decision ---
${input.investmentDecision}

--- Full Risk Debate ---
${state.fullHistory}

--- Analyst Reports (Summary) ---
${input.analystReports.slice(0, 2000)}

${input.existingPositions ? `--- Existing Positions ---\n${input.existingPositions}\n` : ''}
${input.additionalSymbolData ? `--- Additional Candidate Coins ---\n${input.additionalSymbolData}\n` : ''}
Based on the full risk debate above, provide your FINAL risk-adjusted decision.
You MUST respond with ONLY a valid JSON object.
The "reasoning" field in JSON ${buildReasoningLanguageHint(config.locale)}.`;

    // Y7: Risk Judge 用 90s 超时（deep_think 模型可能较慢）
    const response = await this.chatWithTimeout(
      config.deepThinkModel,
      systemPrompt,
      userMessage,
      config.apiKeys,
      {
        temperature: 0.3,
        maxTokens: 800,
      },
      90000,
    );

    // 解析 JSON 结果
    const parsed = this.parseJudgeResponse(response.content);

    return {
      ...parsed,
      cost: response.cost,
    };
  }

  /**
   * 解析法官 JSON 响应
   */
  private parseJudgeResponse(content: string): Omit<
    RiskDebateResult,
    'fullDebateHistory' | 'totalCost' | 'totalLatencyMs'
  > {
    try {
      // 尝试从 markdown code block 中提取 JSON
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // 尝试直接解析
      const parsed = JSON.parse(jsonStr);

      // R5: 提取 adjustedAction（null=保持原方向, 'hold'/'wait'=覆盖为不交易）
      let adjustedAction: AiAction | null = null;
      if (parsed.adjustedAction && typeof parsed.adjustedAction === 'string') {
        const act = parsed.adjustedAction.toLowerCase().trim();
        if (['hold', 'wait', 'open_long', 'open_short', 'close_long', 'close_short'].includes(act)) {
          adjustedAction = act as AiAction;
        }
      }

      return {
        adjustedLeverage: parsed.adjustedLeverage ?? null,
        adjustedPositionSizePercent: parsed.adjustedPositionSizePercent ?? parsed.positionSizePercent ?? null,
        adjustedStopLoss: parsed.adjustedStopLoss ?? parsed.stopLoss ?? null,
        adjustedTakeProfit: parsed.adjustedTakeProfit ?? parsed.takeProfit ?? null,
        adjustedAction,
        riskRating: this.normalizeRiskRating(parsed.riskRating || parsed.risk_rating || 'HIGH'),
        approved: parsed.approved ?? parsed.approve ?? true,
        reasoning: parsed.reasoning || parsed.summary || 'Unable to parse judge reasoning',
      };
    } catch {
      this.logger.warn('[风控辩论] 法官响应 JSON 解析失败，使用保守默认值');
      return {
        adjustedLeverage: null,
        adjustedPositionSizePercent: null,
        adjustedStopLoss: null,
        adjustedTakeProfit: null,
        riskRating: 'HIGH',
        approved: false,
        reasoning: `JSON parse failed. Raw response: ${content.slice(0, 500)}`,
      };
    }
  }

  private normalizeRiskRating(
    rating: string,
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    const upper = rating.toUpperCase();
    if (upper === 'LOW') return 'LOW';
    if (upper === 'MEDIUM' || upper === 'MODERATE') return 'MEDIUM';
    if (upper === 'HIGH') return 'HIGH';
    if (upper === 'EXTREME' || upper === 'CRITICAL') return 'EXTREME';
    return 'HIGH';
  }
}

// ==================== 角色提示词常量 ====================

const AGGRESSIVE_PROMPT = `You are the AGGRESSIVE RISK ASSESSOR in a 3-party risk debate for cryptocurrency futures trading.

## Your Role
You champion high-reward opportunities and question overly conservative approaches. Your goal is to maximize potential returns while acknowledging risks.

## Your Arguments Should:
1. Highlight the potential upside of the proposed trade
2. Argue for higher leverage when the setup is strong
3. Challenge the conservative stance — point out missed opportunities from being too cautious
4. Suggest wider stop losses to avoid premature stops in volatile markets
5. Advocate for larger position sizes when conviction is high

## Key Principles:
- Risk is the price of reward — calculated risk is not recklessness
- Missing a great trade has an opportunity cost
- The market rewards those who act on strong setups
- Tight stops in volatile markets lead to death by a thousand cuts

## Output
Write 100-200 words defending why the trade should proceed with the proposed (or higher) risk parameters. Be specific about numbers (leverage, position size, SL/TP levels).`;

const CONSERVATIVE_PROMPT = `You are the CONSERVATIVE RISK ASSESSOR in a 3-party risk debate for cryptocurrency futures trading.

## Your Role
You prioritize capital preservation above all else. Your goal is to protect the portfolio from significant drawdowns.

## Your Arguments Should:
1. Highlight all possible downside risks of the proposed trade
2. Argue for lower leverage — suggest the minimum needed
3. Challenge the aggressive stance — point out how one bad trade can wipe weeks of gains
4. Suggest tighter stop losses to limit maximum loss per trade
5. Advocate for smaller position sizes (max 2-3% of portfolio per trade)

## Key Principles:
- Capital preservation is the #1 priority — you can't trade if you're wiped out
- The market will always offer new opportunities, but lost capital is gone
- Compounding works both ways — small losses compound into survival
- Risk/Reward must be ≥ 2:1, no exceptions
- Maximum drawdown per trade should not exceed 1-2% of portfolio

## Output
Write 100-200 words arguing for more conservative risk parameters. Be specific about numbers (reduced leverage, tighter stops, smaller positions). Quote specific risks.`;

const NEUTRAL_PROMPT = `You are the NEUTRAL RISK ASSESSOR in a 3-party risk debate for cryptocurrency futures trading.

## Your Role
You provide a balanced evaluation, challenging BOTH the aggressive and conservative perspectives. You aim for optimal risk-adjusted returns.

## Your Arguments Should:
1. Acknowledge valid points from both aggressive and conservative sides
2. Identify the optimal balance between risk and reward
3. Challenge extreme positions on either side
4. Consider the current market volatility regime when sizing risk
5. Propose practical middle-ground parameters

## Key Principles:
- The best trades balance conviction with prudence
- Position sizing should match volatility — bigger in calm markets, smaller in volatile ones
- Risk management is not about avoiding risk, but about sizing it correctly
- Kelly Criterion thinking: bet more when edge is higher, less when uncertain
- Consider correlation with existing positions

## Output
Write 100-200 words with your balanced risk assessment. Propose specific compromise parameters (leverage, position size, SL/TP) that represent the risk-adjusted optimal. Reference points from both other assessors if applicable.`;

const RISK_JUDGE_PROMPT = `You are the RISK JUDGE — the final arbiter of the risk debate for cryptocurrency futures trading.

You have heard arguments from:
- Aggressive: Favoring higher risk/higher reward
- Conservative: Favoring capital preservation
- Neutral: Seeking balanced risk-adjusted returns

## Your Decision

Based on the full debate, provide your FINAL risk-adjusted parameters. You must respond with ONLY a valid JSON object:

{
  "approved": true/false,
  "riskRating": "LOW" | "MEDIUM" | "HIGH" | "EXTREME",
  "adjustedAction": null | "hold" | "wait",
  "adjustedLeverage": number (1-20),
  "adjustedPositionSizePercent": number (1-10),
  "adjustedStopLoss": number | null (price level),
  "adjustedTakeProfit": number | null (price level),
  "reasoning": "Your detailed reasoning (100-300 words) explaining why you chose these parameters and whose arguments were most compelling"
}

## Decision Rules:
- If riskRating is "EXTREME" → approved MUST be false
- adjustedAction: set to null to keep Trader's original direction, or "hold"/"wait" to OVERRIDE the direction and cancel the trade entirely
- adjustedLeverage must be ≤ 20x (hard limit)
- adjustedPositionSizePercent must be ≤ 10% of portfolio
- Risk/Reward ratio must be ≥ 2.0:1
- If no stop loss can be determined → approved = false

DO NOT include any text outside the JSON object.`;
