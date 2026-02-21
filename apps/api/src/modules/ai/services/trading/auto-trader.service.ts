import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { QuickAnalysisService, QuickAnalysisConfig, RecentTrade, TradingStats } from './quick-analysis.service';
import { ConsensusService } from './consensus.service';
import { DebateOrchestratorService, OrchestratorConfig, MultiCoinOrchestratorConfig, MultiCoinOrchestratorResult } from './debate-orchestrator.service';
import { AiExecutionService } from '../ai-execution.service';
import { SafetyService, SafetyCheckInput } from '../safety.service';
import { CoinScannerService } from './coin-scanner.service';
import { MarketDataService } from '../market-data.service';
import { IndicatorsService } from '../indicators.service';
import { StrategyEngineService } from './strategy-engine.service';
import { AiTradeDecision, AiAction, CoinSourceConfig } from '../../types/ai.types';
import { LLMService, UserApiKeys } from '../llm.service';
import { decrypt, EncryptedData } from '../../../../common/utils/crypto.util';
import { TradingGateway } from '../../../../gateways/trading.gateway';
import { GridTradingService, GridConfig } from './grid-trading.service';
import { AI_SAFETY_DEFAULTS } from '../../constants/safety-defaults';

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
    private readonly orchestrator: DebateOrchestratorService,
    private readonly aiExecution: AiExecutionService,
    private readonly safety: SafetyService,
    private readonly coinScanner: CoinScannerService,
    private readonly marketData: MarketDataService,
    private readonly indicators: IndicatorsService,
    private readonly strategyEngine: StrategyEngineService,
    private readonly llmService: LLMService,
    private readonly gateway: TradingGateway,
    private readonly gridTrading: GridTradingService,
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

      // Free 用户门控：无 BYOK Key 的免费用户不能使用平台 Key
      const hasByokKeys = Object.values(apiKeys).some(
        (v) => typeof v === 'string' && (v as string).trim().length > 0,
      );
      if (!hasByokKeys) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { membershipStatus: true, membershipExpireAt: true },
        });
        const isPro =
          user?.membershipStatus === 'active' &&
          user.membershipExpireAt != null &&
          user.membershipExpireAt > new Date();
        if (!isPro) {
          this.logger.warn(
            `[自动交易] 用户 ${userId} 为免费用户且无 BYOK Key，跳过周期`,
          );
          return result;
        }
      }

      if (!(await this.llmService.hasAvailableKey(quickModel, apiKeys))) {
        this.logger.warn(`[自动交易] 用户 ${userId} 无可用 LLM API Key`);
        return result;
      }

      // 策略级 exchangeApiKeyId 优先，回退到全局 aiConfig
      const effectiveExchangeApiKeyId = strategy.exchangeApiKeyId ?? aiConfig.exchangeApiKeyId;
      if (!effectiveExchangeApiKeyId) {
        this.logger.warn(`[自动交易] 用户 ${userId} 未绑定交易所 API Key`);
        return result;
      }

      this.logger.log(
        `[自动交易] 开始周期: 策略=${strategyId}, 模式=${strategy.tradingMode}`,
      );

      // WebSocket: 推送周期开始状态
      this.gateway.sendAiStrategyStatus(userId, {
        strategyId,
        status: 'running',
        lastCycleAt: new Date(),
      });

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
      // 将风控排除币种传递给扫描器，在扫描阶段就过滤
      if (riskControl.excludedCoins && !coinSourceConfig.excludedCoins) {
        coinSourceConfig.excludedCoins = riskControl.excludedCoins;
      }

      const candidates = await this.coinScanner.scanCoins(
        coinSourceConfig,
        apiKeys,
        quickModel,
      );

      this.logger.log(`[自动交易] 候选币种: ${candidates.join(', ')}`);

      // Grid 策略路由: 网格交易走独立循环
      if (strategy.strategyType === 'grid') {
        return await this.runGridCycle(strategy, userId, effectiveExchangeApiKeyId, riskControl, result, startTime);
      }

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

      // E1: 仓位已满预筛选（对齐 NoFx enforceMaxPositions — Pre-AI 拦截，避免浪费 Token）
      // NoFx 在调用 LLM 前先检查仓位数，满则只处理有持仓的币种（允许平仓）
      const effectiveMaxPositions = riskControl.maxPositions ?? 3;
      const positionsFull = existingPositions.length >= effectiveMaxPositions;
      const activeCandidates = positionsFull
        ? candidates.filter(sym =>
            existingPositions.some(p => p.symbol === sym),
          )
        : candidates;

      if (positionsFull && activeCandidates.length < candidates.length) {
        this.logger.log(
          `[风控-E1] 仓位已满 ${existingPositions.length}/${effectiveMaxPositions}，` +
          `候选池从 ${candidates.length} 缩减至 ${activeCandidates.length} 个（仅处理有持仓币种）`,
        );
      }

      // Step 5.5: 查询最近交易记录 + 统计（替代 BM25，NoFx 轻量上下文）
      // Step 5.5: 查询最近交易记录 + 统计
      // 对齐 NoFx RecentOrder (9字段) + TradingStats (8字段)
      const recentPositions = await this.prisma.position.findMany({
        where: {
          userId,
          source: { in: ['ai_research', 'ai_strategy'] },
          status: 'closed',
        },
        orderBy: { closedAt: 'desc' },
        take: 10,
        select: {
          symbol: true,
          side: true,
          entryPrice: true,
          exitPrice: true,
          realizedPnl: true,
          margin: true,
          createdAt: true,
          closedAt: true,
        },
      });

      const recentTrades: RecentTrade[] = recentPositions.map((p) => {
        const entryTime = p.createdAt;
        const exitTime = p.closedAt;
        let holdDuration = 'N/A';
        if (entryTime && exitTime) {
          const diffMs = exitTime.getTime() - entryTime.getTime();
          const hours = Math.floor(diffMs / 3600000);
          const minutes = Math.floor((diffMs % 3600000) / 60000);
          holdDuration = hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
        }
        return {
          symbol: p.symbol,
          side: p.side,
          entryPrice: Number(p.entryPrice || 0),
          exitPrice: Number(p.exitPrice || 0),
          pnl: Number(p.realizedPnl || 0),
          pnlPercent: Number(p.margin) > 0
            ? (Number(p.realizedPnl || 0) / Number(p.margin)) * 100
            : 0,
          entryTime: entryTime?.toISOString().slice(0, 16) || 'N/A',
          closedAt: exitTime?.toISOString().slice(0, 16) || 'N/A',
          holdDuration,
        };
      });

      // 聚合交易统计 — 对齐 NoFx TradingStats (8字段)
      const allClosedForStats = await this.prisma.position.findMany({
        where: { userId, source: { in: ['ai_research', 'ai_strategy'] }, status: 'closed' },
        select: { realizedPnl: true, margin: true },
      });

      const totalTrades = allClosedForStats.length;
      const wins = allClosedForStats.filter((p) => Number(p.realizedPnl || 0) > 0);
      const losses = allClosedForStats.filter((p) => Number(p.realizedPnl || 0) < 0);
      const winRate = totalTrades > 0 ? wins.length / totalTrades : 0;
      const totalPnl = allClosedForStats.reduce((s, p) => s + Number(p.realizedPnl || 0), 0);

      const grossProfit = wins.reduce((s, p) => s + Number(p.realizedPnl || 0), 0);
      const grossLoss = Math.abs(losses.reduce((s, p) => s + Number(p.realizedPnl || 0), 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

      const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
      const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

      // 简化夏普率: mean(pnlPct) / std(pnlPct) × √365
      const pnlPcts = allClosedForStats.map((p) =>
        Number(p.margin) > 0 ? (Number(p.realizedPnl || 0) / Number(p.margin)) * 100 : 0,
      );
      const meanPct = pnlPcts.length > 0 ? pnlPcts.reduce((a, b) => a + b, 0) / pnlPcts.length : 0;
      const variance = pnlPcts.length > 1
        ? pnlPcts.reduce((s, v) => s + (v - meanPct) ** 2, 0) / (pnlPcts.length - 1)
        : 0;
      const stdPct = Math.sqrt(variance);
      const sharpeRatio = stdPct > 0 ? (meanPct / stdPct) * Math.sqrt(365) : 0;

      // 简化最大回撤: 基于累计 PnL 序列
      let peak = 0;
      let maxDrawdownPct = 0;
      let cumPnl = 0;
      // 倒序遍历（从最早到最新）
      for (let i = allClosedForStats.length - 1; i >= 0; i--) {
        cumPnl += Number(allClosedForStats[i].realizedPnl || 0);
        if (cumPnl > peak) peak = cumPnl;
        if (peak > 0) {
          const dd = (peak - cumPnl) / peak;
          if (dd > maxDrawdownPct) maxDrawdownPct = dd;
        }
      }

      const tradingStats: TradingStats = {
        totalTrades,
        winRate,
        profitFactor: Number(profitFactor.toFixed(2)),
        sharpeRatio: Number(sharpeRatio.toFixed(2)),
        totalPnl: Number(totalPnl.toFixed(2)),
        avgWin: Number(avgWin.toFixed(2)),
        avgLoss: Number(avgLoss.toFixed(2)),
        maxDrawdownPct: Number((maxDrawdownPct * 100).toFixed(2)),
      };

      // Step 6 + 7: 对每个候选币种进行 AI 决策 + 安全检查
      const allDecisions: Array<{
        symbol: string;
        decision: AiTradeDecision;
        passed: boolean;
        cost: number;
        consensusVotes?: any[]; // Debate 模式: 各模型投票详情
      }> = [];

      // Phase 9.0 T4: Debate 模式 — 一次辩论覆盖所有候选币（节省 80% LLM 调用）
      // 旧: 5 币 × 28 LLM 调用 = 140 次
      // 新: 1 × 28 LLM 调用 = 28 次
      const debateResults = new Map<string, {
        decision: AiTradeDecision;
        cost: number;
        consensusScore: number;
        consensusVotes: any[];
      }>();

      if (strategy.tradingMode === 'debate' && activeCandidates.length > 0) {
        try {
          const debateConfig = (strategy as any).debateConfig as Record<string, any> | null;
          const promptSections = (strategy as any).promptSections as Record<string, any> | null;

          const multiCoinConfig: MultiCoinOrchestratorConfig = {
            userId,
            strategyId: strategy.id,
            symbols: activeCandidates,
            timeframe,
            secondaryTimeframe,
            models,
            apiKeys,
            maxRounds: debateConfig?.maxRounds || 3,
            riskRounds: debateConfig?.riskRounds || 3,
            temperature: debateConfig?.temperature || 0.7,
            promptConfig: {
              promptSections: promptSections ? {
                role: promptSections.role,
                mode: promptSections.mode,
                custom: promptSections.custom,
              } : undefined,
              riskControl: {
                maxPositions: riskControl.maxPositions,
                maxLeverage: riskControl.maxLeverage,
                maxDailyDrawdown: riskControl.maxDailyDrawdown || maxDailyDrawdown,
                allocatedCapital: riskControl.allocatedCapital,
                maxDailyTrades: riskControl.maxDailyTrades,
                cooldownMinutes: riskControl.cooldownMinutes,
                circuitBreaker: riskControl.circuitBreaker,
              },
              intervalMinutes: strategy.intervalMinutes || 60,
              todayTrades: closedToday.length,
            },
          };

          const multiResult: MultiCoinOrchestratorResult =
            await this.orchestrator.runMultiCoinDebate(multiCoinConfig);

          // 总成本一次性计入（不在逐币循环中重复计算）
          result.totalCost += multiResult.totalCost;

          // 将多币种结果填入 Map
          for (const sym of activeCandidates) {
            const dec = multiResult.decisions[sym];
            if (dec) {
              debateResults.set(sym, {
                decision: dec,
                cost: 0, // 已在上方统一计入 result.totalCost
                consensusScore: multiResult.consensusScores[sym] ?? 5,
                consensusVotes: (multiResult.perSymbolVotes[sym] || []).map(v => ({
                  modelId: v.modelId,
                  action: v.decision.action,
                  confidence: v.decision.confidence,
                  reasoning: v.decision.reasoning || '',
                  weight: v.weight,
                  success: v.success,
                  error: v.error,
                })),
              });
            }
          }

          this.logger.log(
            `[自动交易] 多币种辩论完成: ${candidates.length} 币, 会话=${multiResult.sessionId}, ` +
              `成本 $${multiResult.totalCost.toFixed(6)}, 耗时 ${multiResult.totalLatencyMs}ms`,
          );
        } catch (error) {
          this.logger.error(`[自动交易] 多币种辩论失败: ${error.message}`);
          result.errors++;
          // 辩论整体失败 → debateResults 保持为空 → 逐币循环中降级为 Solo 模式
          this.logger.warn('[自动交易] Debate 降级为 Solo 模式逐币分析');
        }
      }

      for (const symbol of activeCandidates) {
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

          if (debateResults.has(symbol)) {
            // Phase 9.0 T4: Debate 多币种辩论 — 从预计算结果获取（一次辩论覆盖所有币）
            const debateData = debateResults.get(symbol)!;
            decision = debateData.decision;
            cost = debateData.cost; // 0（已在辩论预处理阶段统一计入 result.totalCost）
            debateConsensusScore = debateData.consensusScore;
            consensusVotes = debateData.consensusVotes;
          } else {
            // Solo 模式（或 Debate 降级兜底）: 单模型分析（Phase 9.0: 传入 promptConfig + 最近交易）
            const promptSections = (strategy as any).promptSections as Record<string, any> | null;
            const analysisConfig: QuickAnalysisConfig = {
              userId,
              symbol,
              timeframe,
              secondaryTimeframe,
              modelId: quickModel,
              apiKeys,
              recentTrades,
              tradingStats,
              promptConfig: {
                promptSections: promptSections ? {
                  role: promptSections.role,
                  mode: promptSections.mode,
                  custom: promptSections.custom,
                } : undefined,
                riskControl: {
                  maxPositions: riskControl.maxPositions,
                  maxLeverage: riskControl.maxLeverage,
                  maxDailyDrawdown: riskControl.maxDailyDrawdown || maxDailyDrawdown,
                  allocatedCapital: riskControl.allocatedCapital,
                  maxDailyTrades: riskControl.maxDailyTrades,
                  cooldownMinutes: riskControl.cooldownMinutes,
                  circuitBreaker: riskControl.circuitBreaker,
                },
                intervalMinutes: strategy.intervalMinutes || 60,
                todayTrades: closedToday.length,
              },
            };
            const analysisResult = await this.quickAnalysis.analyze(analysisConfig);
            cost = analysisResult.cost;
            decision = analysisResult.decision;
          }

          // E2: 杠杆自动向下调整（对齐 NoFx validateDecision — 超限调整而非拒绝）
          // NoFx 行为: AI 建议杠杆超过策略上限时, 自动 clamp 到上限, 不直接拒绝整个决策
          if (decision.leverage) {
            const effectiveMaxLev = riskControl.maxLeverage || 20;
            if (decision.leverage > effectiveMaxLev) {
              this.logger.warn(
                `[风控-E2] ${symbol}: AI 建议杠杆 ${decision.leverage}x 超过限制 ${effectiveMaxLev}x，自动调整`,
              );
              decision = { ...decision, leverage: effectiveMaxLev };
            }
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
            // 策略级风控参数，Safety Service 各层将优先使用这些值
            strategyRiskConfig: {
              maxLeverage: riskControl.maxLeverage,
              maxPositions: riskControl.maxPositions,
              maxDailyTrades: riskControl.maxDailyTrades,
              cooldownMinutes: riskControl.cooldownMinutes,
              maxDailyDrawdown: riskControl.maxDailyDrawdown,
              circuitBreaker: riskControl.circuitBreaker != null
                ? { maxConsecutiveLosses: Number(riskControl.circuitBreaker) }
                : undefined,
            },
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

            // WebSocket: 推送安全检查拦截的决策
            this.gateway.sendAiDecision(userId, {
              strategyId,
              symbol,
              action: decision.action,
              confidence: decision.confidence,
              reasoning: `安全检查拦截: ${safetyResult.blockedReason}`,
              source: 'ai_strategy',
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

        // D7: 排除币种检查 — 对齐 NoFx filterExcludedCoins
        const excluded = riskControl.excludedCoins as string[] | undefined;
        if (excluded && excluded.length > 0) {
          const baseSymbol = symbol.split('/')[0]?.toUpperCase();
          if (excluded.some((e: string) => e.toUpperCase() === baseSymbol || e.toUpperCase() === symbol.toUpperCase())) {
            this.logger.log(`[风控] ${symbol} 在排除列表中，跳过`);
            result.decisions.push({
              symbol, action: decision.action, confidence: decision.confidence, executed: false,
            });
            continue;
          }
        }

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

          // WebSocket: 推送 hold/wait 决策
          this.gateway.sendAiDecision(userId, {
            strategyId,
            symbol,
            action: decision.action,
            confidence: decision.confidence,
            reasoning: decision.reasoning?.slice(0, 200),
            source: 'ai_strategy',
          });
          continue;
        }

        try {
          // D6: positionValueRatio 风控 — 对齐 NoFx enforcePositionValueRatio (auto_trader.go L2237-2274)
          // BTC/ETH 允许更高仓位价值比(默认5x)，山寨币限制更低(默认1x)
          if (decision.action === 'open_long' || decision.action === 'open_short') {
            const baseSymbol = symbol.split('/')[0]?.toUpperCase();
            const isMajor = baseSymbol === 'BTC' || baseSymbol === 'ETH';
            const maxRatio = isMajor
              ? (riskControl.btcEthMaxPositionValueRatio ?? 5.0)
              : (riskControl.altcoinMaxPositionValueRatio ?? 1.0);
            const allocCap = riskControl.allocatedCapital || 1000;
            const posValueEst = (decision.positionSizePercent / 100) * allocCap * decision.leverage;
            if (posValueEst > allocCap * maxRatio) {
              this.logger.warn(
                `[风控] ${symbol} 仓位价值 $${posValueEst.toFixed(0)} 超过限制 $${(allocCap * maxRatio).toFixed(0)} (ratio ${maxRatio}x)，跳过`,
              );
              result.decisions.push({
                symbol, action: decision.action, confidence: decision.confidence, executed: false,
              });
              continue;
            }
          }

          // E4: 最小仓位检查（对齐 NoFx validateDecision MinPositionSize）
          // BTC/ETH margin ≥ 60 USDT, 山寨币 margin ≥ 12 USDT
          if (decision.action === 'open_long' || decision.action === 'open_short') {
            const bs = symbol.split('/')[0]?.toUpperCase();
            const isMaj = bs === 'BTC' || bs === 'ETH';
            const allocCap = riskControl.allocatedCapital || 1000;
            const marginEst = (decision.positionSizePercent / 100) * allocCap;
            const minMargin = isMaj
              ? AI_SAFETY_DEFAULTS.minPositionSizeMajor
              : AI_SAFETY_DEFAULTS.minPositionSizeAlt;

            if (marginEst < minMargin) {
              this.logger.warn(
                `[风控-E4] ${symbol} 预估保证金 $${marginEst.toFixed(0)} < 最小 $${minMargin}，跳过`,
              );
              result.decisions.push({
                symbol,
                action: decision.action,
                confidence: decision.confidence,
                executed: false,
              });
              continue;
            }
          }

          // 直接传 positionSizePercent 给执行层（值 1-20）
          // 执行层内部统一做 百分比→USD 转换（基于交易所实际余额）
          // 不在此处预乘 amountPerTrade，避免双重转换
          const execResult = await this.aiExecution.executeDecision(
            userId,
            effectiveExchangeApiKeyId,
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

          // WebSocket: 推送执行结果决策
          this.gateway.sendAiDecision(userId, {
            strategyId,
            symbol,
            action: decision.action,
            confidence: decision.confidence,
            leverage: decision.leverage,
            reasoning: decision.reasoning?.slice(0, 200),
            source: 'ai_strategy',
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

          // WebSocket: 推送执行失败决策
          this.gateway.sendAiDecision(userId, {
            strategyId,
            symbol,
            action: decision.action,
            confidence: decision.confidence,
            reasoning: `执行失败: ${error.message?.slice(0, 100)}`,
            source: 'ai_strategy',
          });
        }
      }

      // 更新策略统计 + lastCycleAt + cycleCount + 重置连续失败计数
      result.totalLatencyMs = Date.now() - startTime;

      const updatedStrategy = await db.aiStrategy.update({
        where: { id: strategyId },
        data: {
          lastCycleAt: new Date(),
          cycleCount: { increment: 1 },
          ...(strategy.consecutiveFailures > 0 ? { consecutiveFailures: 0 } : {}),
        },
      });

      // 检查停止条件 (maxCycles)
      const stopCond = (strategy.stopConditions as any) || {};
      const maxCycles = stopCond.maxCycles || 0;
      if (maxCycles > 0 && updatedStrategy.cycleCount >= maxCycles) {
        this.logger.log(
          `[自动交易] 策略 ${strategyId} 达到最大周期数 ${maxCycles}，自动停止`,
        );
        await db.aiStrategy.update({
          where: { id: strategyId },
          data: { isActive: false },
        });
      }

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

      // WebSocket: 推送周期完成状态
      this.gateway.sendAiStrategyStatus(userId, {
        strategyId,
        status: result.errors > 0 ? 'error' : 'running',
        lastCycleAt: new Date(),
        cycleResult: {
          analyzed: result.analyzed,
          executed: result.executed,
          errors: result.errors,
        },
      });

      return result;
    } catch (error) {
      this.logger.error(
        `[自动交易] 周期异常: 策略=${strategyId} - ${error.message}`,
      );
      result.errors++;
      result.totalLatencyMs = Date.now() - startTime;

      // 连续失败计数 + 自动暂停（≥3 次连续失败）
      await this.handleCycleFailure(strategyId, error.message);

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
   * 网格策略循环（独立于 AI 决策流程）
   */
  private async runGridCycle(
    strategy: any,
    userId: string,
    apiKeyId: string,
    riskControl: any,
    result: CycleResult,
    startTime: number,
  ): Promise<CycleResult> {
    const gridConfig = strategy.gridConfig as GridConfig | null;
    if (!gridConfig) {
      this.logger.warn(`[网格] 策略 ${strategy.id} 缺少 gridConfig`);
      result.errors = 1;
      return result;
    }
    // 如果 gridConfig 没有 symbol，从 coinSourceConfig 获取
    if (!gridConfig.symbol) {
      const coinSource = strategy.coinSourceConfig as { coins?: string[] } | null;
      if (coinSource?.coins?.length) {
        gridConfig.symbol = coinSource.coins[0];
      } else {
        this.logger.warn(`[网格] 策略 ${strategy.id} 缺少交易对配置`);
        result.errors = 1;
        return result;
      }
    }

    try {
      // 初始化网格（幂等：已初始化则跳过）
      const existingState = await this.gridTrading.getGridState(strategy.id);
      if (!existingState) {
        await this.gridTrading.initializeGrid(strategy.id, userId, apiKeyId, gridConfig);
        this.logger.log(`[网格] 策略 ${strategy.id} 初始化完成`);
      }

      // 运行网格循环
      const gridResult = await this.gridTrading.runGridCycle(
        strategy.id,
        userId,
        apiKeyId,
      );

      result.analyzed = 1;
      result.executed = gridResult.trades || 0;
      result.errors = gridResult.errors || 0;
      result.totalLatencyMs = Date.now() - startTime;

      // 推送状态
      this.gateway.sendAiStrategyStatus(userId, {
        strategyId: strategy.id,
        status: 'running',
        lastCycleAt: new Date(),
      });

      return result;
    } catch (error: any) {
      this.logger.error(`[网格] 策略 ${strategy.id} 周期失败: ${error.message}`);
      result.errors = 1;

      // 连续失败计数 + 自动暂停
      await this.handleCycleFailure(strategy.id, error.message);

      return result;
    }
  }

  /**
   * 连续失败处理：累加计数，≥3 次自动暂停策略
   * 对齐 NoFx auto_trader.go handleConsecutiveFailures()
   */
  private async handleCycleFailure(strategyId: string, errorMessage: string): Promise<void> {
    try {
      const updated = await this.prisma.aiStrategy.update({
        where: { id: strategyId },
        data: { consecutiveFailures: { increment: 1 } },
        select: { consecutiveFailures: true, userId: true },
      });

      const failures = updated.consecutiveFailures;
      this.logger.warn(`[自动交易] 策略 ${strategyId} 连续失败 ${failures} 次`);

      if (failures >= 3) {
        // 自动暂停策略
        await this.prisma.aiStrategy.update({
          where: { id: strategyId },
          data: { isActive: false },
        });

        // 移除 BullMQ 定时任务
        try {
          await this.strategyEngine.removeStrategyJob(strategyId);
        } catch { /* 忽略移除失败 */ }

        // 记录日志
        await this.prisma.aiStrategyLog.create({
          data: {
            strategyId,
            symbol: 'ALL',
            decision: {
              action: 'auto_disabled_failure',
              reason: `连续 ${failures} 次周期失败，自动暂停`,
              lastError: errorMessage?.slice(0, 500),
            },
            executed: false,
          },
        });

        // WebSocket 通知
        this.gateway.sendAiStrategyStatus(updated.userId, {
          strategyId,
          status: 'error',
          error: `连续 ${failures} 次失败，策略已自动暂停`,
        });

        this.logger.error(
          `[自动交易] 策略 ${strategyId} 连续失败 ${failures} 次，已自动暂停`,
        );
      }
    } catch (e: any) {
      this.logger.warn(`[自动交易] 更新失败计数异常: ${e.message}`);
    }
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
