import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { QuickAnalysisService, QuickAnalysisConfig } from './quick-analysis.service';
import { ConsensusService, ConsensusConfig, ConsensusResult } from './consensus.service';
import { AiExecutionService } from './ai-execution.service';
import { SafetyService, SafetyCheckInput } from './safety.service';
import { CoinScannerService } from './coin-scanner.service';
import { MarketDataService } from './market-data.service';
import { IndicatorsService } from './indicators.service';
import { StrategyEngineService } from './strategy-engine.service';
import { AiTradeDecision, AiAction, CoinSourceConfig } from '../types/ai.types';
import { LLMService, UserApiKeys } from './llm.service';
import { decrypt, EncryptedData } from '../../../common/utils/crypto.util';

/**
 * 单周期结果
 */
export interface CycleResult {
  strategyId: string;
  analyzed: number;
  executed: number;
  errors: number;
  decisions: CycleDecision[];
  totalCost: number;
  totalLatencyMs: number;
}

interface CycleDecision {
  symbol: string;
  action: AiAction;
  confidence: number;
  executed: boolean;
  error?: string;
}

/**
 * 自动交易服务 — 产品 B 核心循环引擎
 *
 * 精确参考 NoFx runCycle 9 步流程:
 *
 * Step 1: 检查策略是否停止
 * Step 2: 检查是否被风控暂停
 * Step 3: 重置每日 PnL（24h 周期）
 * Step 4: 构建交易上下文（余额、持仓、候选币种、市场数据、指标）
 * Step 5: 检查现有持仓（是否需要平仓/调仓）
 * Step 6: AI 决策（Solo 或 Debate 模式）
 * Step 7: 9 层安全检查
 * Step 8: 排序决策（平仓优先）
 * Step 9: 逐一执行
 */
@Injectable()
export class AutoTraderService {
  private readonly logger = new Logger(AutoTraderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quickAnalysis: QuickAnalysisService,
    private readonly consensus: ConsensusService,
    private readonly aiExecution: AiExecutionService,
    private readonly safety: SafetyService,
    private readonly coinScanner: CoinScannerService,
    private readonly marketData: MarketDataService,
    private readonly indicators: IndicatorsService,
    private readonly strategyEngine: StrategyEngineService,
    private readonly llmService: LLMService,
  ) {}

  /**
   * 运行一次策略循环（由 BullMQ strategy-cycle job 触发）
   */
  async runCycle(strategyId: string): Promise<CycleResult> {
    const startTime = Date.now();
    const result: CycleResult = {
      strategyId,
      analyzed: 0,
      executed: 0,
      errors: 0,
      decisions: [],
      totalCost: 0,
      totalLatencyMs: 0,
    };

    try {
      // Step 1: 检查策略是否停止
      const db = this.prisma;
      const strategy = await db.aiStrategy.findUnique({
        where: { id: strategyId },
      });

      if (!strategy || !strategy.isActive) {
        this.logger.debug(`[自动交易] 策略 ${strategyId} 已停止，跳过`);
        return result;
      }

      const userId = strategy.userId;

      // 获取用户 AI 配置
      const aiConfig = await this.prisma.aiConfig.findUnique({
        where: { userId },
      });

      if (!aiConfig || !aiConfig.isEnabled) {
        this.logger.warn(`[自动交易] 用户 ${userId} AI 未启用`);
        return result;
      }

      const models = (aiConfig.models as string[]) || ['deepseek-chat'];
      const quickModel = models[0] || 'deepseek-chat';

      // 双轨制 Key 解析：用户自备 Key（解密）→ 平台默认 Key
      const rawApiKeys = (aiConfig.apiKeys as any) || {};
      const apiKeys = this.resolveApiKeys(rawApiKeys);
      if (!this.llmService.hasAvailableKey(quickModel, apiKeys)) {
        this.logger.warn(`[自动交易] 用户 ${userId} 无可用 LLM API Key`);
        return result;
      }

      if (!aiConfig.exchangeApiKeyId) {
        this.logger.warn(`[自动交易] 用户 ${userId} 未绑定交易所 API Key`);
        return result;
      }

      this.logger.log(
        `[自动交易] 开始周期: 策略=${strategyId}, 模式=${strategy.tradingMode}`,
      );

      // Step 2: 检查是否被风控暂停
      // 2a: 策略级暂停检查（riskControlConfig 中的 pauseUntil）
      const riskControl = (strategy.riskControlConfig as any) || {};
      if (riskControl.pauseUntil && new Date(riskControl.pauseUntil) > new Date()) {
        this.logger.log(
          `[自动交易] 策略 ${strategyId} 被风控暂停至 ${riskControl.pauseUntil}`,
        );
        return result;
      }

      // 2b: 日 PnL 预检（提前拦截，避免后续无效的 AI 调用消耗 token）
      const maxDailyDrawdown = riskControl.maxDailyDrawdown || aiConfig.maxDailyDrawdown || 100;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const closedToday = await this.prisma.position.findMany({
        where: {
          userId,
          source: { in: ['ai_research', 'ai_strategy'] },
          status: 'closed',
          closedAt: { gte: todayStart },
        },
        select: { realizedPnl: true },
      });
      const closedPnl = closedToday.reduce(
        (sum, p) => sum + Number(p.realizedPnl || 0), 0,
      );

      const openPositions = await this.prisma.position.findMany({
        where: {
          userId,
          source: { in: ['ai_research', 'ai_strategy'] },
          status: 'open',
        },
        select: { unrealizedPnl: true },
      });
      const unrealizedPnl = openPositions.reduce(
        (sum, p) => sum + Number(p.unrealizedPnl || 0), 0,
      );

      const totalDailyPnl = closedPnl + unrealizedPnl;
      if (totalDailyPnl < -maxDailyDrawdown) {
        this.logger.warn(
          `[自动交易] 策略 ${strategyId} 日回撤熔断: $${Math.abs(totalDailyPnl).toFixed(2)} 超过限制 $${maxDailyDrawdown}`,
        );

        // 记录熔断事件到策略日志
        await this.prisma.aiStrategyLog.create({
          data: {
            strategyId,
            symbol: 'ALL',
            decision: {
              action: 'circuit_breaker',
              reason: `Daily drawdown $${Math.abs(totalDailyPnl).toFixed(2)} exceeds limit $${maxDailyDrawdown}`,
              closedPnl,
              unrealizedPnl,
              totalDailyPnl,
            },
            executed: false,
          },
        });

        result.errors = 1;
        return result;
      }

      // Step 3: 扫描候选币种
      const coinSourceConfig = (strategy.coinSourceConfig as unknown as CoinSourceConfig) || {
        mode: 'static' as const,
        coins: ['BTC/USDT', 'ETH/USDT'],
      };

      const candidates = await this.coinScanner.scanCoins(
        coinSourceConfig,
        apiKeys,
        quickModel,
      );

      this.logger.log(`[自动交易] 候选币种: ${candidates.join(', ')}`);

      // Step 4: 获取指标配置
      const indicatorConfig = (strategy.indicatorConfig as any) || {};
      const timeframe = indicatorConfig.timeframe || '4h';
      const secondaryTimeframe = indicatorConfig.secondaryTimeframe || '1d';

      // Step 5: 检查现有 AI 持仓
      const existingPositions = await this.prisma.position.findMany({
        where: {
          userId,
          status: 'open',
          source: { in: ['ai_research', 'ai_strategy'] },
        },
      });

      // Step 6 + 7: 对每个候选币种进行 AI 决策 + 安全检查
      const allDecisions: Array<{
        symbol: string;
        decision: AiTradeDecision;
        passed: boolean;
        cost: number;
        consensusVotes?: any[]; // Debate 模式: 各模型投票详情
      }> = [];

      for (const symbol of candidates) {
        try {
          // 检查是否已有该币种的持仓（已有则跳过开仓，允许平仓决策）
          const hasPosition = existingPositions.some(
            (p) => p.symbol === symbol && p.status === 'open',
          );

          // Step 6: AI 决策
          let decision: AiTradeDecision;
          let cost = 0;
          let debateConsensusScore = 5; // Solo 模式默认满分（跳过 L2 共识检查）
          let consensusVotes: any[] | undefined; // Debate 模式各模型投票详情

          if (strategy.tradingMode === 'debate') {
            // Debate 模式: 多个不同 LLM 模型独立分析 → 加权投票
            // 每个模型各自调用 quick-analysis，互不干扰，最终汇总共识
            // 与产品 A 的 5 角色对抗辩论完全不同
            const consensusConfig: ConsensusConfig = {
              userId,
              symbol,
              timeframe,
              secondaryTimeframe,
              models, // 用户配置的多个模型（如 deepseek-chat, gpt-4o-mini 等）
              apiKeys,
            };

            const consensusResult: ConsensusResult = await this.consensus.runConsensus(consensusConfig);
            cost = consensusResult.totalCost;
            debateConsensusScore = consensusResult.consensusScore;

            // 保存各模型投票详情（持久化到 AiStrategyLog，供前端展示）
            consensusVotes = consensusResult.votes.map(v => ({
              modelId: v.modelId,
              action: v.decision.action,
              confidence: v.decision.confidence,
              weight: v.weight,
              success: v.success,
              error: v.error,
            }));

            decision = {
              action: consensusResult.consensusAction,
              confidence: consensusResult.avgConfidence,
              leverage: consensusResult.avgLeverage,
              positionSizePercent: consensusResult.avgPositionSizePercent,
              stopLoss: consensusResult.avgStopLoss,
              takeProfit: consensusResult.avgTakeProfit,
              reasoning: consensusResult.reasoning,
            };
          } else {
            // Solo 模式: 单模型分析
            const analysisConfig: QuickAnalysisConfig = {
              userId,
              symbol,
              timeframe,
              secondaryTimeframe,
              modelId: quickModel,
              apiKeys,
            };
            const analysisResult = await this.quickAnalysis.analyze(analysisConfig);
            cost = analysisResult.cost;
            decision = analysisResult.decision;
          }

          result.analyzed++;
          result.totalCost += cost;

          // 如果已有持仓且决策是开仓方向，跳过
          if (hasPosition && (decision.action === 'open_long' || decision.action === 'open_short')) {
            this.logger.log(
              `[自动交易] ${symbol} 已有持仓，跳过开仓决策 ${decision.action}`,
            );
            result.decisions.push({
              symbol,
              action: decision.action,
              confidence: decision.confidence,
              executed: false,
              error: '已有持仓，跳过开仓',
            });
            continue;
          }

          // Step 7: 安全检查
          // Solo 模式: consensusScore = 5（满分），跳过 L2 共识检查
          // Debate 模式: 使用辩论的实际共识得分（0-5）
          const safetyInput: SafetyCheckInput = {
            userId,
            symbol,
            direction: this.actionToDirection(decision.action),
            action: decision.action,
            confidence: decision.confidence,
            consensusScore: debateConsensusScore,
            positionSize: decision.positionSizePercent,
            leverage: decision.leverage,
          };

          const safetyResult = await this.safety.checkAll(safetyInput);

          if (!safetyResult.passed) {
            this.logger.log(
              `[自动交易] ${symbol} 安全检查未通过: ${safetyResult.blockedBy} - ${safetyResult.blockedReason}`,
            );
            result.decisions.push({
              symbol,
              action: decision.action,
              confidence: decision.confidence,
              executed: false,
              error: `安全检查: ${safetyResult.blockedReason}`,
            });

            // 记录安全检查失败到策略日志
            await db.aiStrategyLog.create({
              data: {
                strategyId,
                symbol,
                decision: {
                  action: decision.action,
                  confidence: decision.confidence,
                  reasoning: decision.reasoning,
                  ...(consensusVotes ? { votes: consensusVotes } : {}),
                },
                executed: false,
                executionResult: {
                  blocked: true,
                  blockedBy: safetyResult.blockedBy,
                  reason: safetyResult.blockedReason,
                },
              },
            });
            continue;
          }

          allDecisions.push({ symbol, decision, passed: true, cost, consensusVotes });
        } catch (error) {
          result.errors++;
          this.logger.error(
            `[自动交易] ${symbol} 分析失败: ${error.message}`,
          );
          result.decisions.push({
            symbol,
            action: 'hold',
            confidence: 0,
            executed: false,
            error: error.message,
          });
        }
      }

      // Step 8: 排序决策（平仓优先 → 开仓 → hold/wait）
      const sortedDecisions = this.sortDecisions(allDecisions);

      // Step 9: 逐一执行
      for (const item of sortedDecisions) {
        // 再次检查策略是否仍然激活
        const freshStrategy = await db.aiStrategy.findUnique({
          where: { id: strategyId },
          select: { isActive: true },
        });
        if (!freshStrategy?.isActive) {
          this.logger.log('[自动交易] 策略已停止，中断执行');
          break;
        }

        const { symbol, decision, consensusVotes: votes } = item;

        // hold/wait: 记录日志但不执行交易
        if (decision.action === 'hold' || decision.action === 'wait') {
          result.decisions.push({
            symbol,
            action: decision.action,
            confidence: decision.confidence,
            executed: false,
          });

          await db.aiStrategyLog.create({
            data: {
              strategyId,
              symbol,
              decision: {
                action: decision.action,
                confidence: decision.confidence,
                reasoning: decision.reasoning,
                ...(votes ? { votes } : {}),
              },
              executed: false,
              executionResult: { skipped: true, reason: decision.action },
            },
          });
          continue;
        }

        try {
          // 直接传 positionSizePercent 给执行层（值 1-20）
          // 执行层内部统一做 百分比→USD 转换（基于交易所实际余额）
          // 不在此处预乘 amountPerTrade，避免双重转换
          const execResult = await this.aiExecution.executeDecision(
            userId,
            aiConfig.exchangeApiKeyId!,
            {
              symbol,
              action: decision.action,
              confidence: decision.confidence,
              leverage: decision.leverage,
              positionSizeUSD: decision.positionSizePercent,
              stopLoss: decision.stopLoss || undefined,
              takeProfit: decision.takeProfit || undefined,
              reasoning: decision.reasoning,
              maxTradeAmountUSD: riskControl.maxTradeAmountUSD,
              allocatedCapital: riskControl.allocatedCapital,
            },
            'ai_strategy',
            strategyId,
          );

          if (execResult.success) {
            result.executed++;
          }

          result.decisions.push({
            symbol,
            action: decision.action,
            confidence: decision.confidence,
            executed: execResult.success,
            error: execResult.error,
          });

          // 记录到策略日志
          await db.aiStrategyLog.create({
            data: {
              strategyId,
              symbol,
              decision: {
                action: decision.action,
                confidence: decision.confidence,
                leverage: decision.leverage,
                positionSizePercent: decision.positionSizePercent,
                stopLoss: decision.stopLoss,
                takeProfit: decision.takeProfit,
                reasoning: decision.reasoning,
                ...(votes ? { votes } : {}),
              },
              executed: execResult.success,
              executionResult: {
                orderId: execResult.orderId,
                positionId: execResult.positionId,
                error: execResult.error,
              },
            },
          });

          // 执行间隔 1 秒（避免 rate limit）
          await this.sleep(1000);
        } catch (error) {
          result.errors++;
          this.logger.error(`[自动交易] 执行失败 ${symbol}: ${error.message}`);

          result.decisions.push({
            symbol,
            action: decision.action,
            confidence: decision.confidence,
            executed: false,
            error: error.message,
          });

          // 记录失败日志
          await db.aiStrategyLog.create({
            data: {
              strategyId,
              symbol,
              decision: {
                action: decision.action,
                confidence: decision.confidence,
                reasoning: decision.reasoning,
                ...(votes ? { votes } : {}),
              },
              executed: false,
              executionResult: { error: error.message },
            },
          });
        }
      }

      // 更新策略统计 + lastCycleAt
      result.totalLatencyMs = Date.now() - startTime;

      await db.aiStrategy.update({
        where: { id: strategyId },
        data: { lastCycleAt: new Date() },
      });

      // 累加 LLM 费用到 aiConfig.currentSpend
      if (result.totalCost > 0) {
        try {
          const newSpend = Number(aiConfig.currentSpend) + result.totalCost;
          await db.aiConfig.update({
            where: { userId },
            data: { currentSpend: newSpend },
          });
        } catch (e) {
          this.logger.warn(`[自动交易] 更新费用失败: ${e.message}`);
        }
      }

      this.logger.log(
        `[自动交易] 周期完成: 策略=${strategyId}, ` +
          `分析=${result.analyzed}, 执行=${result.executed}, 错误=${result.errors}, ` +
          `耗时 ${result.totalLatencyMs}ms, 成本 $${result.totalCost.toFixed(6)}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[自动交易] 周期异常: 策略=${strategyId} - ${error.message}`,
      );
      result.errors++;
      result.totalLatencyMs = Date.now() - startTime;
      return result;
    }
  }

  // ========================= 决策排序 =========================

  /**
   * 排序决策（精确复制 NoFx sortDecisionsByPriority）
   * close → open → hold/wait
   */
  private sortDecisions(
    decisions: Array<{
      symbol: string;
      decision: AiTradeDecision;
      passed: boolean;
      cost: number;
      consensusVotes?: any[];
    }>,
  ): typeof decisions {
    const priority = (action: AiAction): number => {
      switch (action) {
        case 'close_long':
        case 'close_short':
          return 1; // 先平仓
        case 'open_long':
        case 'open_short':
          return 2; // 后开仓
        case 'hold':
        case 'wait':
        default:
          return 3; // 最后
      }
    };

    return [...decisions].sort(
      (a, b) => priority(a.decision.action) - priority(b.decision.action),
    );
  }

  // ========================= 辅助方法 =========================

  /**
   * 6-action → buy/sell/hold 方向（safety.service 需要）
   */
  private actionToDirection(action: AiAction): string {
    switch (action) {
      case 'open_long':
      case 'close_short':
        return 'buy';
      case 'open_short':
      case 'close_long':
        return 'sell';
      default:
        return 'hold';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 解析 API Keys：如果是加密格式则解密，否则原样返回（向后兼容）
   */
  private resolveApiKeys(raw: any): UserApiKeys {
    if (!raw || typeof raw !== 'object') return {};
    const result: UserApiKeys = {};
    for (const provider of ['deepseek', 'openai', 'openrouter']) {
      const val = raw[provider];
      if (!val) continue;
      if (typeof val === 'object' && val.encryptedData && val.iv && val.authTag) {
        try { result[provider] = decrypt(val as EncryptedData); } catch { /* 解密失败忽略 */ }
      } else if (typeof val === 'string') {
        result[provider] = val;
      }
    }
    return result;
  }
}
