import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LLMService, UserApiKeys } from '../llm.service';
import { AiMemoryService } from '../memory.service';

/**
 * 反思角色定义
 *
 * TradingAgents 原版 5 角色: bull, bear, trader, invest_judge, risk_manager
 * GAP-D 扩展: 加入 analyst, contrarian (HOOT 辩论独有角色)
 * 确保所有参与辩论的角色都能进行反思学习、积累 BM25 记忆
 */
export type ReflectionRole =
  | 'bull'
  | 'bear'
  | 'analyst'
  | 'contrarian'
  | 'trader'
  | 'invest_judge'
  | 'risk_manager';

const ALL_ROLES: ReflectionRole[] = [
  'bull',
  'bear',
  'analyst',
  'contrarian',
  'trader',
  'invest_judge',
  'risk_manager',
];

/**
 * 反思输入
 */
export interface ReflectionInput {
  sessionId: string;
  userId: string;
  symbol: string;
  sceneText: string; // BM25 场景文本
  actualReturns: number; // 实际 PnL（百分比）
  actualPnl: number; // 实际 PnL（USDT）
  action: string; // 执行的动作
  apiKeys: UserApiKeys;
  quickThinkModel: string;

  // 各角色的历史文本（来自研究会话）
  bullHistory?: string;
  bearHistory?: string;
  analystDebateHistory?: string;   // GAP-D: analyst 辩论发言
  contrarianHistory?: string;      // GAP-D: contrarian 辩论发言
  traderPlan?: string;
  investJudgeDecision?: string;
  riskManagerDecision?: string;
  analystReports?: string;
}

/**
 * 单角色反思结果
 */
export interface RoleReflectionResult {
  role: ReflectionRole;
  reflection: string; // 压缩后的反思总结（≤1000 tokens）
  cost: number;
  success: boolean;
  error?: string;
}

/**
 * 全量反思结果
 */
export interface ReflectionResult {
  sessionId: string;
  roles: RoleReflectionResult[];
  totalCost: number;
  totalLatencyMs: number;
}

/**
 * 研究反思服务
 *
 * 对应 TradingAgents reflection.py — 交易完成后对每个角色单独反思
 *
 * 流程：
 * 1. 平仓后触发（由 ai-execution.service 调用）
 * 2. 对 5 个角色各自生成反思（并行）
 * 3. 每个反思压缩为 ≤1000 token 总结
 * 4. 存入对应角色的 BM25 记忆（role 标记在 sceneText 前缀中）
 *
 * 关键差异 vs TradingAgents：
 * - TradingAgents 每角色独立 BM25 实例 → 我们用 sceneText 前缀 [role:xxx] 区分
 * - TradingAgents 用 LangGraph 状态 → 我们从 AiResearchSession.stages 提取各角色历史
 */
@Injectable()
export class ResearchReflectionService {
  private readonly logger = new Logger(ResearchReflectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMService,
    private readonly memory: AiMemoryService,
  ) {}

  /**
   * 对已完成的交易执行 5 路并行反思
   */
  async reflectOnTrade(input: ReflectionInput): Promise<ReflectionResult> {
    const startTime = Date.now();

    this.logger.log(
      `[反思] 开始: ${input.symbol}, 会话 ${input.sessionId}, ` +
        `实际回报 ${input.actualReturns >= 0 ? '+' : ''}${input.actualReturns.toFixed(2)}%`,
    );

    // 并行对 5 个角色生成反思
    const reflectionPromises = ALL_ROLES.map((role) =>
      this.reflectForRole(role, input).catch((error) => ({
        role,
        reflection: '',
        cost: 0,
        success: false,
        error: error.message || String(error),
      })),
    );

    const results = await Promise.all(reflectionPromises);

    // 统计
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    const successCount = results.filter((r) => r.success).length;
    const totalLatencyMs = Date.now() - startTime;

    this.logger.log(
      `[反思] 完成: ${successCount}/${ALL_ROLES.length} 角色成功, ` +
        `总耗时 ${totalLatencyMs}ms, 总成本 $${totalCost.toFixed(6)}`,
    );

    // 更新研究会话的反思结果
    await this.saveReflectionToSession(input.sessionId, results);

    return {
      sessionId: input.sessionId,
      roles: results,
      totalCost,
      totalLatencyMs,
    };
  }

  // ==================== 单角色反思 ====================

  private async reflectForRole(
    role: ReflectionRole,
    input: ReflectionInput,
  ): Promise<RoleReflectionResult> {
    // 获取该角色的历史文本
    const roleHistory = this.getRoleHistory(role, input);
    if (!roleHistory) {
      this.logger.log(`[反思] ${role} — 无历史文本，跳过`);
      return { role, reflection: '', cost: 0, success: true };
    }

    this.logger.log(`[反思] ${role} — 生成反思...`);

    const systemPrompt = REFLECTION_SYSTEM_PROMPT;
    const userMessage = this.buildReflectionMessage(role, roleHistory, input);

    try {
      const response = await this.llm.chat(
        input.quickThinkModel,
        systemPrompt,
        userMessage,
        input.apiKeys,
        {
          temperature: 0.4,
          maxTokens: 500, // 压缩反思，控制在 ≤1000 tokens
        },
      );

      // 存入 BM25 记忆（角色标记在 sceneText 前缀）
      const roleTaggedScene = `[role:${role}] ${input.sceneText}`;
      const reflectionLesson = this.extractLesson(response.content, input.actualReturns);

      await this.memory.storeMemory({
        userId: input.userId,
        analysisId: input.sessionId,
        symbol: input.symbol,
        sceneText: roleTaggedScene,
        action: input.action,
        pnl: input.actualPnl,
        pnlPercent: input.actualReturns,
      });

      this.logger.log(`[反思] ${role} — 完成, 成本 $${response.cost.toFixed(6)}`);

      return {
        role,
        reflection: response.content,
        cost: response.cost,
        success: true,
      };
    } catch (error) {
      this.logger.warn(`[反思] ${role} — 失败: ${error.message}`);
      return {
        role,
        reflection: '',
        cost: 0,
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== 角色历史提取 ====================

  private getRoleHistory(
    role: ReflectionRole,
    input: ReflectionInput,
  ): string | null {
    switch (role) {
      case 'bull':
        return input.bullHistory || null;
      case 'bear':
        return input.bearHistory || null;
      case 'analyst':
        return input.analystDebateHistory || null;
      case 'contrarian':
        return input.contrarianHistory || null;
      case 'trader':
        return input.traderPlan || null;
      case 'invest_judge':
        return input.investJudgeDecision || null;
      case 'risk_manager':
        return input.riskManagerDecision || null;
    }
  }

  // ==================== 反思消息构建 ====================

  private buildReflectionMessage(
    role: ReflectionRole,
    roleHistory: string,
    input: ReflectionInput,
  ): string {
    const resultStr =
      input.actualReturns >= 0
        ? `PROFIT +${input.actualReturns.toFixed(2)}% ($${input.actualPnl.toFixed(2)})`
        : `LOSS ${input.actualReturns.toFixed(2)}% ($${input.actualPnl.toFixed(2)})`;

    const roleLabel = ROLE_LABELS[role];

    return `=== TRADE REFLECTION for ${roleLabel} ===

Symbol: ${input.symbol}
Action Taken: ${input.action}
Actual Result: ${resultStr}

--- Your Analysis/Decision ---
${roleHistory.slice(0, 2000)}

--- Market Context (Analyst Reports Summary) ---
${(input.analystReports || '').slice(0, 1500)}

Based on the actual result, reflect on your analysis:
1. **Reasoning**: Was your analysis correct? Which factors did you correctly identify and which did you miss?
2. **Improvement**: If your analysis was wrong, what should you have focused on instead?
3. **Summary**: Key lessons learned for similar future scenarios.
4. **Query**: Distill the most important insight into a single concise sentence (this will be stored in memory for future retrieval).

Keep your total response under 400 words. Focus on actionable insights, not excuses.`;
  }

  // ==================== 教训提取 ====================

  /**
   * 从反思文本中提取关键教训
   */
  private extractLesson(reflectionText: string, actualReturns: number): string {
    // 尝试从 "Query:" 或 "4." 段提取
    const queryMatch = reflectionText.match(
      /(?:Query|4\.|Key Insight)[:\s]*(.+?)(?:\n|$)/i,
    );
    if (queryMatch) {
      return queryMatch[1].trim().slice(0, 200);
    }

    // 降级: 取第一句
    const firstSentence = reflectionText.split(/[.\n]/)[0]?.trim();
    if (firstSentence) {
      return firstSentence.slice(0, 200);
    }

    return actualReturns >= 0 ? '交易盈利，方向正确' : '交易亏损，需调整策略';
  }

  // ==================== 会话更新 ====================

  private async saveReflectionToSession(
    sessionId: string,
    results: RoleReflectionResult[],
  ): Promise<void> {
    try {
      const db = this.prisma;
      const session = await db.aiResearchSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) return;

      // 将反思结果追加到 stages JSON
      const stages = (session.stages as any[]) || [];
      stages.push({
        stage: 6, // 反思为第 6 阶段（5 阶段研究 + 1 反思）
        name: '交易后反思',
        status: 'completed',
        result: {
          reflections: results.map((r) => ({
            role: r.role,
            success: r.success,
            cost: r.cost,
            preview: r.reflection.slice(0, 200),
          })),
        },
        cost: results.reduce((sum, r) => sum + r.cost, 0),
        completedAt: new Date().toISOString(),
      });

      await db.aiResearchSession.update({
        where: { id: sessionId },
        data: { stages },
      });
    } catch (error) {
      this.logger.warn(`[反思] 更新会话失败: ${error.message}`);
    }
  }

  /**
   * 从研究会话中提取反思输入
   *
   * 便捷方法: 从 AiResearchSession 的 stages JSON 中提取各角色历史
   */
  async buildReflectionInputFromSession(
    sessionId: string,
    userId: string,
    actualPnl: number,
    actualReturns: number,
    action: string,
    apiKeys: UserApiKeys,
    quickThinkModel: string,
  ): Promise<ReflectionInput | null> {
    try {
      const db = this.prisma;
      const session = await db.aiResearchSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        this.logger.warn(`[反思] 会话 ${sessionId} 不存在`);
        return null;
      }

      const stages = (session.stages as any[]) || [];

      // 从各阶段提取角色历史
      const stage2 = stages.find((s: any) => s.stage === 2);
      const stage3 = stages.find((s: any) => s.stage === 3);
      const stage4 = stages.find((s: any) => s.stage === 4);
      const stage1 = stages.find((s: any) => s.stage === 1);

      return {
        sessionId,
        userId,
        symbol: session.symbol,
        sceneText: stage1?.result?.sceneText || `${session.symbol} analysis`,
        actualReturns,
        actualPnl,
        action,
        apiKeys,
        quickThinkModel,

        // 从辩论历史中提取（Stage 2 投资辩论）
        bullHistory: stage2?.result?.debate?.bullHistory || null,
        bearHistory: stage2?.result?.debate?.bearHistory || null,

        // GAP-D: 从辩论条目中提取 analyst 和 contrarian 历史
        analystDebateHistory: this.extractRoleFromDebateEntries(stage2, 'analyst') || undefined,
        contrarianHistory: this.extractRoleFromDebateEntries(stage2, 'contrarian') || undefined,

        // Stage 3 交易员提案
        traderPlan: stage3?.result?.traderPlan || null,

        // Stage 2 法官裁决
        investJudgeDecision: stage2?.result?.debate?.judgeDecision || null,

        // Stage 4 风控裁决
        riskManagerDecision: stage4?.result?.riskDebate?.reasoning || null,

        // Stage 1 分析师报告
        analystReports: stage1?.result?.reportsSummary || null,
      };
    } catch (error) {
      this.logger.warn(`[反思] 构建输入失败: ${error.message}`);
      return null;
    }
  }

  /**
   * GAP-D: 从辩论 Stage 结果中提取指定角色的发言历史
   *
   * debate.service 的 entries 存储了每个角色每轮的发言记录
   */
  private extractRoleFromDebateEntries(stage2: any, role: string): string | null {
    if (!stage2?.result?.debate?.entries) return null;
    const entries = stage2.result.debate.entries as Array<{
      role: string;
      round: number;
      arguments?: { reasoning?: string; keyPoints?: string[] };
      confidence?: number;
      direction?: string;
    }>;
    const roleEntries = entries.filter((e) => e.role === role);
    if (roleEntries.length === 0) return null;

    return roleEntries.map((e) => {
      const parts = [`[${role.toUpperCase()} Round ${e.round}] ${e.direction || ''} @ ${e.confidence || 0}%`];
      if (e.arguments?.reasoning) parts.push(e.arguments.reasoning);
      if (e.arguments?.keyPoints?.length) {
        parts.push('Key Points: ' + e.arguments.keyPoints.join('; '));
      }
      return parts.join('\n');
    }).join('\n\n');
  }
}

// ==================== 角色标签 ====================

const ROLE_LABELS: Record<ReflectionRole, string> = {
  bull: 'Bull Analyst (Bullish Perspective)',
  bear: 'Bear Analyst (Bearish Perspective)',
  analyst: 'Technical Analyst (Data-Driven Neutral)',
  contrarian: 'Contrarian Analyst (Sentiment Reversal)',
  trader: 'Trader (Execution Planner)',
  invest_judge: 'Investment Judge (Decision Maker)',
  risk_manager: 'Risk Manager (Risk Assessor)',
};

// ==================== 反思系统提示词 ====================

/**
 * 对应 TradingAgents reflection_system_prompt
 */
const REFLECTION_SYSTEM_PROMPT = `You are an expert financial analyst reviewing cryptocurrency futures trading decisions.

Your task is to reflect on a completed trade — analyzing what went right, what went wrong, and extracting actionable lessons for the future.

## Reflection Framework

1. **Reasoning**: Evaluate whether the original analysis was correct. Identify:
   - Which market signals were correctly interpreted
   - Which signals were missed or misinterpreted
   - Whether the timing was appropriate

2. **Improvement**: For incorrect analyses, propose specific revisions:
   - What data points should have been weighted differently
   - What additional context was needed
   - How risk parameters should have been adjusted

3. **Summary**: Distill the key lessons:
   - Pattern recognition improvements
   - Risk management adjustments
   - Decision framework refinements

4. **Query**: Extract the single most important insight into a concise sentence (max 50 words).
   This will be stored in a BM25 memory system for retrieval in similar future scenarios.

## Guidelines
- Be specific with numbers (prices, percentages, ratios)
- Focus on actionable improvements, not post-hoc rationalization
- Acknowledge when the original analysis was correct even if the trade lost (market can be unpredictable)
- Keep total response under 400 words
- The "Query" section is CRITICAL — it must be a concise, searchable insight sentence`;
