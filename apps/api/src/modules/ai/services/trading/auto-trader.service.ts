import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
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
import { translateExchangeError } from '../../utils/error-translator';
import { CircuitBreakerService } from '../../../trading/config/circuit-breaker.service';
import { ClosedPnlSyncService } from '../../../trading/closed-pnl-sync.service';
import { AdapterFactoryService } from '../../../exchange-adapters/adapter-factory.service';

/**
 * Debate 模式各模型投票详情
 */
export interface ConsensusVote {
  modelId: string;
  action: string;
  confidence: number;
  reasoning: string;
  weight: number;
  success: boolean;
  error?: string;
  leverage?: number;
  positionSizePercent?: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
}

/**
 * 策略风控配置（对应 riskControlConfig JSON 字段）
 *
 * 字段分类:
 * - CODE ENFORCED: MaxPositions, PositionValueRatio, MinPositionSize, AdaptPositionToBalance
 * - AI GUIDED: MaxLeverage (分BTC/ETH和山寨), MinRiskRewardRatio, MinConfidence
 * - 多用户额外: maxDailyDrawdown, maxDailyTrades, cooldownMinutes, circuitBreaker
 */
interface RiskControlConfig {
  // === HOOT 已有字段（保留） ===
  pauseUntil?: string;
  maxDailyDrawdown?: number;
  maxPositions?: number;           // CODE ENFORCED, 默认 3
  maxLeverage?: number;            // fallback 杠杆上限
  maxDailyTrades?: number;
  maxTradeAmountUSD?: number;
  allocatedCapital?: number;
  cooldownMinutes?: number;
  circuitBreaker?: number;
  excludedCoins?: string[];
  btcEthMaxPositionValueRatio?: number;   // CODE ENFORCED, 默认 5.0
  altcoinMaxPositionValueRatio?: number;  // CODE ENFORCED, 默认 1.0

  // === 杠杆与风控字段 ===
  btcEthMaxLeverage?: number;      // AI GUIDED, 默认 5（BTC/ETH 分类杠杆）
  altcoinMaxLeverage?: number;     // AI GUIDED, 默认 5（山寨币分类杠杆）
  minRiskRewardRatio?: number;     // AI GUIDED, 默认 1.5（最小风险收益比）
  minConfidence?: number;          // AI GUIDED, 默认 60（最小置信度）
  minPositionSize?: number;        // CODE ENFORCED, 默认 12（最小仓位 USDT）
  maxMarginUsage?: number;         // CODE ENFORCED, 默认 0.9（最大保证金使用率）
}

/** 策略指标配置（对应 indicatorConfig JSON 字段） */
interface IndicatorConfig {
  timeframe?: string;
  secondaryTimeframe?: string;
  [key: string]: unknown;
}

/** 策略停止条件（对应 stopConditions JSON 字段） */
interface StopConditionsConfig {
  maxCycles?: number;
  profitTargetPercent?: number;
  maxLossPercent?: number;
  [key: string]: unknown;
}

/** promptSections JSON 字段 */
interface PromptSections {
  role?: string;
  mode?: 'aggressive' | 'conservative' | 'scalping';
  custom?: string;
  [key: string]: unknown;
}

/** debateConfig JSON 字段 */
interface DebateConfig {
  maxRounds?: number;
  riskRounds?: number;
  temperature?: number;
  [key: string]: unknown;
}

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
 * 核心 9 步循环流程:
 *
 * Step 1: 检查策略是否停止
 * Step 2: 检查是否被风控暂停
 * Step 3: 重置每日 PnL（24h 周期）
 * Step 4: 构建交易上下文（余额、持仓、候选币种、市场数据、指标）
 * Step 5: 检查现有持仓（是否需要平仓/调仓）
 * Step 6: AI 决策（三种模式，互相独立，勿混淆）：
 *   - 极速策略 (quick/默认): tradingMode 非 debate/research → 单模型 QuickAnalysisService 分析
 *   - 共识策略 (debate):      tradingMode === 'debate' → N 模型各自独立分析 + 投票聚合（无辩论轮次）
 *   - 深研策略 (research):    tradingMode === 'research' → Stage2 投资辩论 + Stage3 风控辩论 + Stage4 共识投票
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
    @Optional() private readonly circuitBreaker?: CircuitBreakerService,
    @Optional() private readonly closedPnlSyncService?: ClosedPnlSyncService,
    @Optional() private readonly adapterFactory?: AdapterFactoryService,
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
      // Step 0: 熔断器检查
      if (this.circuitBreaker) {
        const cbName = `ai_strategy_${strategyId}`;
        const canExec = await this.circuitBreaker.canExecute(cbName);
        if (!canExec) {
          this.logger.warn(`[熔断] 策略 ${strategyId} 熔断器开启，跳过本周期`);
          result.totalLatencyMs = Date.now() - startTime;
          return result;
        }
      }

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
      this.logger.debug(`[自动交易] runCycle: strategy=${strategyId}, user=${userId}`);

      // 获取用户 AI 配置
      const aiConfig = await this.prisma.aiConfig.findUnique({
        where: { userId },
      });

      if (!aiConfig || !aiConfig.isEnabled) {
        this.logger.warn(`[自动交易] 用户 ${userId} AI 未启用`);
        return result;
      }

      // 月度预算检查：超出则跳过本周期，避免产生额外 LLM 费用
      const monthlyBudget = Number(aiConfig.monthlyBudget) || 0;
      if (monthlyBudget > 0) {
        const currentSpend = Number(aiConfig.currentSpend) || 0;
        if (currentSpend >= monthlyBudget) {
          this.logger.warn(
            `[自动交易] 用户 ${userId} 月度 LLM 预算已用尽 ` +
            `($${currentSpend.toFixed(4)} / $${monthlyBudget})，跳过本周期`,
          );
          return result;
        }
      }

      let models = (aiConfig.models as string[]) || ['deepseek-chat'];

      // 策略级模型列表优先于全局 AI 配置（strategy.models 由创建策略时指定，Debate 模式必需）
      const strategyModels = strategy.models as string[] | null;
      if (strategyModels && strategyModels.length > 0) {
        models = strategyModels;
        this.logger.debug(
          `[自动交易] 使用策略级模型(${models.length}个): ${models.join(', ')}`,
        );
      }

      const quickModel = models[0] || 'deepseek-chat';
      const locale = (aiConfig as unknown as Record<string, unknown>).locale as string || 'zh-CN';

      // 共识/深研模式模型数校验已移至 startStrategy() 启动时，运行时仅记录异常
      if (
        (strategy.tradingMode === 'debate' || strategy.tradingMode === 'research') &&
        models.length < AI_SAFETY_DEFAULTS.minConsensusModels
      ) {
        this.logger.warn(
          `[自动交易] ${strategy.tradingMode} 模式建议至少 ${AI_SAFETY_DEFAULTS.minConsensusModels} 个模型（当前 ${models.length}），继续执行`,
        );
      }

      // 双轨制 Key 解析：用户自备 Key（解密）→ 平台默认 Key
      const rawApiKeys = (aiConfig.apiKeys as Record<string, unknown>) || {};
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
        `\n${'='.repeat(70)}\n` +
        `⏰ ${new Date().toISOString().slice(0, 19).replace('T', ' ')} - AI 决策周期 #${strategy.cycleCount || 0}\n` +
        `${'='.repeat(70)}\n` +
        `  策略=${strategyId}, 模式=${strategy.tradingMode}, 间隔=${strategy.intervalMinutes || 60}min`,
      );

      // WebSocket: 推送周期开始状态
      this.gateway.sendAiStrategyStatus(userId, {
        strategyId,
        status: 'running',
        lastCycleAt: new Date(),
      });

      // 网格策略优先路由: 有独立的回撤保护，跳过用户级日回撤检查
      // 网格策略不使用通用持仓同步 — 网格有自己的持仓生命周期（close_long/close_short 指令）
      if (strategy.strategyType === 'grid') {
        return await this.runGridCycle(strategy, userId, effectiveExchangeApiKeyId, result, startTime, locale);
      }

      // R2: 周期性持仓同步 — 交易所 SL/TP 触发平仓后同步 DB（仅用于非网格策略）
      // 架构原则：syncPositionsForUser 返回交易所实时持仓，后续所有决策基于此数据，DB 仅用于历史记录
      let liveExchangePositions: any[] = [];
      try {
        const syncResult = await this.strategyEngine.syncPositionsForUser(userId, effectiveExchangeApiKeyId, strategy.id);
        liveExchangePositions = syncResult.exchangePositions;
        if (syncResult.created > 0 || syncResult.closed > 0) {
          this.logger.log(
            `[R2] 持仓同步: 新建${syncResult.created}, 关闭${syncResult.closed}, 交易所持仓=${liveExchangePositions.length}`,
          );
        }
      } catch (e: any) {
        this.logger.warn(`[R2] 持仓同步失败(非致命): ${e.message}`);
      }

      // Step 2: 检查是否被风控暂停
      // 2a: 策略级暂停检查（riskControlConfig 中的 pauseUntil）
      const riskControl = (strategy.riskControlConfig as RiskControlConfig) || {};
      if (riskControl.pauseUntil && new Date(riskControl.pauseUntil) > new Date()) {
        this.logger.log(
          `[自动交易] 策略 ${strategyId} 被风控暂停至 ${riskControl.pauseUntil}`,
        );
        return result;
      }

      // 2b: 日 PnL 预检（提前拦截，避免后续无效的 AI 调用消耗 token）
      const maxDailyDrawdown: number = riskControl.maxDailyDrawdown || Number(aiConfig.maxDailyDrawdown) || 100;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const closedToday = await this.prisma.position.findMany({
        where: {
          userId,
          source: { in: ['ai_analysis', 'ai_research', 'ai_strategy'] },
          status: 'closed',
          closedAt: { gte: todayStart },
          aiStrategyId: strategy.id, // 封印：只统计当前策略的PnL，不混入网格
        },
        select: { realizedPnl: true },
      });
      const closedPnl = closedToday.reduce(
        (sum, p) => sum + Number(p.realizedPnl || 0), 0,
      );

      // 使用交易所实时持仓的 unrealizedPnl（不再查 DB 快照）
      const unrealizedPnl = liveExchangePositions.reduce(
        (sum: number, p: any) => sum + Number(p.unrealizedPnl || 0), 0,
      );

      const totalDailyPnl = closedPnl + unrealizedPnl;
      if (totalDailyPnl < -maxDailyDrawdown) {
        this.logger.warn(
          `[自动交易] 策略 ${strategyId} 日回撤熔断: $${Math.abs(totalDailyPnl).toFixed(2)} 超过限制 $${maxDailyDrawdown}`,
        );

        // 记录熔断事件到策略日志
        const pauseReason = `日回撤 $${Math.abs(totalDailyPnl).toFixed(2)} 超过限制 $${maxDailyDrawdown}`;
        await this.prisma.aiStrategyLog.create({
          data: {
            strategyId,
            symbol: 'ALL',
            decision: {
              action: 'circuit_breaker',
              reason: pauseReason,
              closedPnl,
              unrealizedPnl,
              totalDailyPnl,
              maxDailyDrawdown,
            },
            executed: false,
          },
        });

        // 平仓：关闭该策略所有持仓，盈利部分在 closePosition 内自动扣燃油费
        try {
          await this.aiExecution.closeAllStrategyPositions(userId, strategyId, effectiveExchangeApiKeyId);
        } catch (e: any) {
          this.logger.error(`[自动交易] 日回撤熔断平仓失败(继续停策略): ${e.message}`);
        }

        // 风控暂停：停止策略 + 记录原因到 riskControlConfig._riskPause
        await this.prisma.aiStrategy.update({
          where: { id: strategyId },
          data: {
            isActive: false,
            riskControlConfig: {
              ...riskControl,
              _riskPause: {
                source: 'daily_drawdown',
                reason: pauseReason,
                pausedAt: new Date().toISOString(),
                totalDailyPnl,
                maxDailyDrawdown,
              },
            },
          },
        });

        // 移除 BullMQ 定时任务
        try {
          await this.strategyEngine.removeStrategyJob(strategyId);
        } catch { /* 忽略 */ }

        // WebSocket 通知用户
        this.gateway.sendAiStrategyStatus(userId, {
          strategyId,
          status: 'stopped',
          error: pauseReason,
        });

        this.logger.warn(`[自动交易] 策略 ${strategyId} 日回撤风控暂停: ${pauseReason}`);

        result.errors = 1;
        return result;
      }

      // Step 3: 扫描候选币种
      const coinSourceConfig = (strategy.coinSourceConfig as unknown as CoinSourceConfig) || {
        mode: 'static' as const,
        coins: ['BTC/USDT', 'ETH/USDT'],
      };
      // 策略级模型列表优先（创建策略时由前端保存在 coinSourceConfig.models）
      if (coinSourceConfig.models && coinSourceConfig.models.length > 0) {
        models = coinSourceConfig.models;
        this.logger.debug(
          `[自动交易] 使用策略级模型(${models.length}个): ${models.join(', ')}`,
        );
      }

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

      // Step 4: 获取指标配置
      const indicatorConfig = (strategy.indicatorConfig as IndicatorConfig) || {};
      const timeframe = indicatorConfig.timeframe || '4h';
      const secondaryTimeframe = indicatorConfig.secondaryTimeframe || '1d';

      // Step 5: 检查现有 AI 持仓（交易所实时数据 + DB 策略归属标记）
      // 架构：交易所持仓是唯一事实，DB 仅提供 aiStrategyId 归属（syncPositionsForUser 已同步）
      const dbPositionsForAttribution = await this.prisma.position.findMany({
        where: {
          userId,
          status: 'open',
          source: { in: ['ai_research', 'ai_strategy'] },
        },
        select: { id: true, symbol: true, side: true, aiStrategyId: true, peakPnlPercent: true, createdAt: true },
      });
      // 合并：以交易所实时数据为准，从 DB 补充策略归属
      const existingPositions = liveExchangePositions.map((ep: any) => {
        const dbMatch = dbPositionsForAttribution.find(
          (dp) => dp.symbol === ep.symbol && dp.side === ep.side,
        );
        return {
          symbol: ep.symbol,
          side: ep.side,
          entryPrice: ep.entryPrice,
          amount: ep.quantity,
          margin: ep.margin ?? 0,
          leverage: ep.leverage ?? 1,
          unrealizedPnl: ep.unrealizedPnl ?? 0,
          highWaterMark: dbMatch?.peakPnlPercent ? Number(dbMatch.peakPnlPercent) : null,
          aiStrategyId: dbMatch?.aiStrategyId ?? null,
          id: dbMatch?.id ?? null,
          // 对齐 nofx formatPositionInfo: 补充持仓时长、当前价、强平价
          createdAt: dbMatch?.createdAt ?? null,
          markPrice: ep.markPrice ?? ep.entryPrice ?? 0,
          liquidationPrice: ep.liquidationPrice ?? 0,
        };
      });

      // E1: 仓位已满预筛选（Pre-AI 拦截，避免浪费 Token）
      // 修复: maxPositions 仅计入本策略的持仓，避免其他策略持仓误触发本策略的仓位限制
      const effectiveMaxPositions = riskControl.maxPositions ?? 3;
      const thisStrategyOpenPositions = existingPositions.filter(p => p.aiStrategyId === strategy.id);
      const positionsFull = thisStrategyOpenPositions.length >= effectiveMaxPositions;

      // 持仓币种必须始终在候选列表中（允许 AI 管理/平仓已有持仓）
      // 否则 coinScanner 轮换扫描时，未选中的持仓币种无法被 AI 平仓
      const positionSymbols = thisStrategyOpenPositions.map(p => p.symbol);
      const candidatesWithPositions = [
        ...candidates,
        ...positionSymbols.filter(s => !candidates.includes(s)),
      ];

      const activeCandidates = positionsFull
        ? candidatesWithPositions.filter(sym =>
            thisStrategyOpenPositions.some(p => p.symbol === sym),
          )
        : candidatesWithPositions;

      if (positionSymbols.some(s => !candidates.includes(s))) {
        this.logger.log(
          `[E1] 持仓币种补入候选池: ${positionSymbols.filter(s => !candidates.includes(s)).join(', ')}`,
        );
      }
      if (positionsFull && activeCandidates.length < candidatesWithPositions.length) {
        this.logger.log(
          `[风控-E1] 仓位已满 ${thisStrategyOpenPositions.length}/${effectiveMaxPositions}（本策略），` +
          `候选池从 ${candidatesWithPositions.length} 缩减至 ${activeCandidates.length} 个（仅处理有持仓币种）`,
        );
      }

      // 账户信息快照
      this.logger.log(
        `📊 账户快照: 配置资金=$${(riskControl.allocatedCapital || 1000).toFixed(0)} USDT | ` +
        `当前持仓=${existingPositions.length}/${effectiveMaxPositions} | ` +
        `今日已关=${closedToday.length}笔 | 今日PnL=$${totalDailyPnl.toFixed(2)}`,
      );

      // Step 5.1: 拉取交易所真实余额（1次/周期，失败降级到 allocatedCapital）
      let exchangeBalance: { totalEquity: number; availableBalance: number; usedMargin: number } | null = null;
      try {
        exchangeBalance = await this.aiExecution.getFullBalance(userId, effectiveExchangeApiKeyId);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`[账户] 交易所余额获取失败，降级到 allocatedCapital: ${errMsg}`);
        // key 被删/禁用属于致命配置错误（不同于网络抖动），写前端可见日志后终止本周期
        const isFatalKeyError =
          errMsg.includes('凭证不存在') ||
          errMsg.includes('凭证已禁用') ||
          errMsg.includes('无权使用此凭证');
        if (isFatalKeyError) {
          await this.prisma.aiStrategyLog.create({
            data: {
              strategyId,
              symbol: (strategy.coinSourceConfig as any)?.coins?.[0] || 'ALL',
              decision: {
                action: 'auto_disabled_failure',
                reason: '交易所 API Key 已被删除或禁用，请重新绑定',
                lastError: errMsg,
              },
              executed: false,
            },
          }).catch(() => {});
          return result;
        }
      }

      // Step 2b-Live: 日回撤二次校验（使用交易所实时权益，补偿 DB unrealizedPnl 的快照延迟）
      // 期货账户恒等式：totalEquity = availableBalance + usedMargin + liveUnrealizedPnl
      // 故 liveUnrealizedPnl = totalEquity - availableBalance - usedMargin（含账户全部期货浮亏）
      if (exchangeBalance) {
        const liveUnrealizedPnl =
          exchangeBalance.totalEquity - exchangeBalance.availableBalance - exchangeBalance.usedMargin;
        const liveTotalDailyPnl = closedPnl + liveUnrealizedPnl;
        if (liveTotalDailyPnl < -maxDailyDrawdown) {
          this.logger.warn(
            `[自动交易] 策略 ${strategyId} 日回撤熔断（实时）: 浮亏=$${Math.abs(liveUnrealizedPnl).toFixed(2)}，` +
            `今日总PnL=$${liveTotalDailyPnl.toFixed(2)} < -$${maxDailyDrawdown}` +
            `（DB快照=$${totalDailyPnl.toFixed(2)}，差值=$${Math.abs(liveTotalDailyPnl - totalDailyPnl).toFixed(2)}）`,
          );
          await this.prisma.aiStrategyLog.create({
            data: {
              strategyId,
              symbol: 'ALL',
              decision: {
                action: 'circuit_breaker',
                reason: `日回撤实时校验 $${Math.abs(liveTotalDailyPnl).toFixed(2)} 超过限制 $${maxDailyDrawdown}`,
                closedPnl,
                liveUnrealizedPnl,
                liveTotalDailyPnl,
                dbSnapshot: totalDailyPnl,
              },
              executed: false,
            },
          }).catch(() => {});

          // 平仓 + 扣燃油费
          try {
            await this.aiExecution.closeAllStrategyPositions(userId, strategyId, effectiveExchangeApiKeyId);
          } catch (e: any) {
            this.logger.error(`[自动交易] 日回撤熔断（实时）平仓失败(继续停策略): ${e.message}`);
          }

          // 本检查点之前的 DB 快照检查未触发，需在此处补全停策略逻辑
          await this.prisma.aiStrategy.update({
            where: { id: strategyId },
            data: {
              isActive: false,
              riskControlConfig: {
                ...riskControl,
                _riskPause: {
                  source: 'daily_drawdown_live',
                  reason: `日回撤实时校验 $${Math.abs(liveTotalDailyPnl).toFixed(2)} > 限制 $${maxDailyDrawdown}`,
                  pausedAt: new Date().toISOString(),
                  liveTotalDailyPnl,
                  maxDailyDrawdown,
                },
              },
            },
          });
          try { await this.strategyEngine.removeStrategyJob(strategyId); } catch { /* 忽略 */ }
          this.gateway.sendAiStrategyStatus(userId, {
            strategyId,
            status: 'stopped',
            error: `日回撤熔断（实时）: $${Math.abs(liveTotalDailyPnl).toFixed(2)} 超限`,
          });

          result.errors = 1;
          return result;
        }
      }

      // Step 5.2: 分类持仓 + 构建 accountInfo（注入 Prompt 让 LLM 看到真实余额/持仓）
      const allocCap = riskControl.allocatedCapital || 1000;
      const thisStrategyPositions = existingPositions.filter(p => p.aiStrategyId === strategy.id);
      const otherPositions = existingPositions.filter(p => p.aiStrategyId !== strategy.id);

      const thisMargin = thisStrategyPositions.reduce((sum, p) => sum + Number(p.margin || 0), 0);
      const thisUnrealizedPnl = thisStrategyPositions.reduce((sum, p) => sum + Number(p.unrealizedPnl || 0), 0);
      const otherMargin = otherPositions.reduce((sum, p) => sum + Number(p.margin || 0), 0);

      const accountInfo = {
        exchangeTotalEquity: exchangeBalance?.totalEquity ?? allocCap,
        exchangeAvailableBalance: exchangeBalance?.availableBalance ?? allocCap,
        allocatedCapital: allocCap,
        strategyMarginUsed: thisMargin,
        strategyUnrealizedPnl: thisUnrealizedPnl,
        strategyPositions: thisStrategyPositions.map(p => ({
          symbol: p.symbol,
          side: p.side,
          entryPrice: Number(p.entryPrice),
          size: Number(p.amount),
          leverage: p.leverage ?? 1,
          pnlPercent: Number(p.margin) > 0 ? (Number(p.unrealizedPnl || 0) / Number(p.margin)) * 100 : 0,
          peakPnlPercent: p.highWaterMark ? Number(p.highWaterMark) : undefined,
          margin: Number(p.margin || 0),
          // 对齐 nofx formatPositionInfo: 传入持仓时长、当前价、强平价
          holdMinutes: p.createdAt ? Math.round((Date.now() - new Date(p.createdAt).getTime()) / 60000) : undefined,
          markPrice: Number(p.markPrice || 0) || undefined,
          liqPrice: Number((p as any).liquidationPrice || 0) || undefined,
        })),
        otherStrategiesCount: otherPositions.length,
        otherStrategiesMargin: otherMargin,
      };

      this.logger.log(
        `📊 账户详情: 交易所权益=$${accountInfo.exchangeTotalEquity.toFixed(2)} | ` +
        `策略预算=$${allocCap} | 本策略持仓=${thisStrategyPositions.length} (保证金=$${thisMargin.toFixed(2)}) | ` +
        `其他策略持仓=${otherPositions.length} (保证金=$${otherMargin.toFixed(2)})`,
      );

      // 权益快照（对齐 nofx saveEquitySnapshot，每个周期保存，含空转周期）
      this.prisma.equitySnapshot.create({
        data: {
          strategyId: strategy.id,
          equity: accountInfo.exchangeTotalEquity.toString(),
          availBalance: accountInfo.exchangeAvailableBalance.toString(),
          positionValue: thisMargin.toString(),
          unrealizedPnl: thisUnrealizedPnl.toString(),
        },
      }).catch(e => this.logger.warn(`权益快照保存失败(非致命): ${e.message}`));

      // Step 5.5: 查询最近交易记录 + 统计（RecentOrder 9字段 + TradingStats 8字段）
      const recentPositions = await this.prisma.position.findMany({
        where: {
          userId,
          source: { in: ['ai_research', 'ai_strategy'] },
          status: 'closed',
          aiStrategyId: strategy.id,
          // 排除 syncPositionsForUser 产生的重复 close 记录
          closeReason: { notIn: ['manual', 'not_found_on_exchange'] },
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

      // 聚合交易统计（TradingStats 8字段）
      // 限定最近 30 天的已平仓位，避免历史旧仓位污染 Sharpe/WinRate
      const statsLookback = new Date();
      statsLookback.setDate(statsLookback.getDate() - 30);
      const allClosedForStats = await this.prisma.position.findMany({
        where: {
          userId,
          source: { in: ['ai_research', 'ai_strategy'] },
          status: 'closed',
          closedAt: { gte: statsLookback },
          aiStrategyId: strategy.id,
          // 排除 syncPositionsForUser 产生的重复 close 记录（manual/not_found_on_exchange）
          closeReason: { notIn: ['manual', 'not_found_on_exchange'] },
        },
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

      // 最大回撤: 基于 allocatedCapital 的百分比（对齐 nofx，避免微利时 100% 回撤误导 AI）
      const ddBase = riskControl.allocatedCapital || 1000;
      let peak = 0;
      let maxDrawdownPct = 0;
      let cumPnl = 0;
      // 倒序遍历（从最早到最新）
      for (let i = allClosedForStats.length - 1; i >= 0; i--) {
        cumPnl += Number(allClosedForStats[i].realizedPnl || 0);
        if (cumPnl > peak) peak = cumPnl;
        if (peak > 0) {
          // 回撤基于策略预算而非峰值，防止微利时 100% 虚高
          const dd = Math.min(1, (peak - cumPnl) / ddBase);
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

      // 交易统计上下文
      if (tradingStats.totalTrades > 0) {
        this.logger.log(
          `📈 交易统计: ${tradingStats.totalTrades}笔, ` +
          `胜率=${(tradingStats.winRate * 100).toFixed(1)}%, PF=${tradingStats.profitFactor}, ` +
          `Sharpe=${tradingStats.sharpeRatio}, DD=${tradingStats.maxDrawdownPct}%`,
        );
      }

      // 持久化统计到 AiStrategy 表（前端卡片展示）
      // winRate 从 0-1 转为 0-100 存储（与 DB Decimal(5,2) 对齐）
      void this.strategyEngine.updateStats(strategyId, {
        totalTrades: tradingStats.totalTrades,
        totalPnl: tradingStats.totalPnl,
        winRate: Number((tradingStats.winRate * 100).toFixed(2)),
        sharpe: tradingStats.sharpeRatio,
      });

      // Step 5.7: 计算连续 wait/hold 周期数 + 提取上轮决策摘要（注入 Prompt）
      const recentStrategyLogs = await db.aiStrategyLog.findMany({
        where: { strategyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { decision: true, symbol: true, createdAt: true, executed: true },
      });
      // 策略运行时长（分钟，对齐 nofx RuntimeMinutes）
      const strategyRuntimeMin = strategy.createdAt
        ? Math.round((Date.now() - new Date(strategy.createdAt).getTime()) / 60000)
        : undefined;

      // 提取上轮 AI 决策摘要（最近 1 轮的所有币种决策，注入 prompt 提供决策连续性）
      const lastDecisions: Array<{ symbol: string; action: string; confidence: number; reasoning: string; timestamp: string }> = [];
      if (recentStrategyLogs.length > 0) {
        // 找最近一轮的时间戳（同一轮可能有多条记录，每个币种一条）
        const lastTime = recentStrategyLogs[0].createdAt;
        const lastTimeCutoff = new Date(lastTime.getTime() - 60_000); // 1分钟内视为同一轮
        for (const log of recentStrategyLogs) {
          if (log.createdAt < lastTimeCutoff) break; // 超过1分钟的不是同一轮
          const d = log.decision as any;
          if (d?.action) {
            // 过滤已执行的 close 决策 — 平仓完成后不注入下轮，避免 AI 重复平仓
            const isExecutedClose = (d.action === 'close_long' || d.action === 'close_short') && (log as any).executed;
            if (isExecutedClose) continue;
            lastDecisions.push({
              symbol: log.symbol || d.symbol || 'unknown',
              action: d.action,
              confidence: d.confidence ?? 0,
              reasoning: d.reasoning || '',
              timestamp: log.createdAt.toISOString().slice(0, 16),
            });
          }
        }
      }

      if (lastDecisions.length > 0) {
        this.logger.log(`📋 上轮决策: ${lastDecisions.length}条 → [${lastDecisions.map(d => `${d.symbol}:${d.action}(${d.confidence}%)`).join(', ')}]`);
      }

      // nofx 风格上下文摘要（对齐 auto_trader_decision.go buildTradingContext 日志）
      {
        const btcEthLev = riskControl.btcEthMaxLeverage ?? riskControl.maxLeverage ?? 5;
        const altLev = riskControl.altcoinMaxLeverage ?? riskControl.maxLeverage ?? 5;
        this.logger.log(
          `📋 杠杆配置: BTC/ETH=${btcEthLev}x, 山寨币=${altLev}x\n` +
          `📋 候选币: ${activeCandidates.join(', ')} (${activeCandidates.length}个)\n` +
          `📊 近期交易: ${recentTrades.length}笔已平仓\n` +
          `📈 交易统计: ${tradingStats.totalTrades}笔, 胜率=${(tradingStats.winRate * 100).toFixed(1)}%, ` +
          `PF=${tradingStats.profitFactor}, Sharpe=${tradingStats.sharpeRatio}, DD=${tradingStats.maxDrawdownPct}%`,
        );
      }

      // Step 6 + 7: 对每个候选币种进行 AI 决策 + 安全检查
      const allDecisions: Array<{
        symbol: string;
        decision: AiTradeDecision;
        passed: boolean;
        cost: number;
        consensusScore: number; // 共识得分 (0-5)，Solo=5
        consensusVotes?: ConsensusVote[]; // Debate 模式: 各模型投票详情
        // 日志透明化：Solo 模式携带 prompt 数据
        rawResponse?: string;
        systemPrompt?: string;
        userPrompt?: string;
        analysis?: string;   // 整体市场分析（<reasoning>标签内容）
        aiThinking?: string;
        marketSnapshot?: any;
      }> = [];


      // Phase 9.0 T4: Debate 模式 — 一次辩论覆盖所有候选币（节省 80% LLM 调用）
      // 旧: 5 币 × 28 LLM 调用 = 140 次
      // 新: 1 × 28 LLM 调用 = 28 次
      const debateResults = new Map<string, {
        decision: AiTradeDecision;
        cost: number;
        consensusScore: number;
        consensusVotes: ConsensusVote[];
      }>();
      // 市场数据快照（Debate 模式由编排器预获取，供安全检查使用）
      let debateMarketSnapshots: Record<string, {
        currentPrice: number;
        fundingRate?: number;
        volume24h?: number;
        priceChange1h?: number;
        indicators: { rsi: number | null; atr3: number | null; atr14: number | null };
      }> = {};
      // 极速全局分析的完整结果（日志透明化用，保存 rawResponse/systemPrompt/userPrompt/aiThinking/marketSnapshot）
      const quickGlobalResults = new Map<string, { rawResponse?: string; systemPrompt?: string; userPrompt?: string; analysis?: string; aiThinking?: string; marketSnapshot?: any }>();

      // ═══════════════════════════════════════════════════════════════════════
      // 【共识策略 — debate 模式】
      //
      // 工作方式：N 个模型各自独立分析（无辩论轮次），最终汇总投票决出获胜方向。
      // 调用路径：ConsensusService.runMultiCoinConsensus()（非 runFullDebate）
      //
      // ⚠ 注意：debateConfig.maxRounds 字段虽然传入，但共识模式本身不存在"辩论轮次"。
      //   该字段对共识策略无实质效果，仅深研策略（research 模式）真正使用 maxRounds/riskRounds。
      //
      // 与深研策略（research）的关键区别：
      //   - debate（共识）: 模型独立思考 → 投票聚合 → 出决策（无 Stage2/Stage3 辩论）
      //   - research（深研）: Stage2 投资辩论 → Stage3 风控辩论 → Stage4 共识投票
      // ═══════════════════════════════════════════════════════════════════════
      if (strategy.tradingMode === 'debate' && activeCandidates.length > 0) {
        const debateConfig = strategy.debateConfig as DebateConfig | null;
        this.logger.log(
          `🗳 共识策略(debate): ${activeCandidates.length} 个候选币, ${models.length} 模型独立投票, ` +
          `时间框架=${timeframe}/${secondaryTimeframe}`,
        );
        try {
          const promptSections = strategy.promptSections as PromptSections | null;

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
            accountInfo,
            promptConfig: {
              promptSections: promptSections ? {
                role: promptSections.role,
                mode: promptSections.mode,
                custom: promptSections.custom,
              } : undefined,
              riskControl: {
                maxPositions: riskControl.maxPositions,
                maxLeverage: riskControl.maxLeverage,
                btcEthMaxLeverage: riskControl.btcEthMaxLeverage,
                altcoinMaxLeverage: riskControl.altcoinMaxLeverage,
                minRiskRewardRatio: riskControl.minRiskRewardRatio,
                minConfidence: riskControl.minConfidence,
                minPositionSize: riskControl.minPositionSize,
                maxDailyDrawdown: riskControl.maxDailyDrawdown || maxDailyDrawdown,
                allocatedCapital: riskControl.allocatedCapital,
                maxDailyTrades: riskControl.maxDailyTrades,
                cooldownMinutes: riskControl.cooldownMinutes,
                circuitBreaker: riskControl.circuitBreaker,
              },
              intervalMinutes: strategy.intervalMinutes || 60,
              todayTrades: closedToday.length,

              locale,
            },
          };

          const multiResult: MultiCoinOrchestratorResult =
            await this.orchestrator.runMultiCoinDebate(multiCoinConfig);

          // 总成本一次性计入（不在逐币循环中重复计算）
          result.totalCost += multiResult.totalCost;
          // 保存市场数据快照（供安全检查 L3/L8/L9 使用）
          debateMarketSnapshots = multiResult.marketDataSnapshots || {};

          // 将多币种结果填入 Map（orchestrator 保证每个 sym 都有 decisions[sym]）
          for (const sym of activeCandidates) {
            const dec = multiResult.decisions[sym];
            if (!dec) {
              this.logger.warn(`[多币种辩论] ${sym}: 编排器未返回决策（不应发生），将降级 Solo 分析`);
            }
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
                  leverage: v.decision.leverage,
                  positionSizePercent: v.decision.positionSizePercent,
                  stopLoss: v.decision.stopLoss ?? null,
                  takeProfit: v.decision.takeProfit ?? null,
                })),
              });
            }
          }

          // Debate 结果汇总
          const debateSummaryLines = activeCandidates
            .map(sym => {
              const dr = debateResults.get(sym);
              if (!dr) return `  ${sym}: 无结果`;
              const d = dr.decision;
              return `  ${sym}: ${d.action} (conf=${d.confidence}%, lev=${d.leverage}x, score=${dr.consensusScore}/${models.length})`;
            })
            .join('\n');
          this.logger.log(
            `[自动交易] 多币种辩论完成: ${candidates.length} 币, 会话=${multiResult.sessionId}, ` +
              `成本=$${multiResult.totalCost.toFixed(6)}, 耗时=${multiResult.totalLatencyMs}ms\n` +
              debateSummaryLines,
          );
        } catch (error) {
          this.logger.error(`[自动交易] 多币种辩论失败: ${error.message}`);
          result.errors++;
          // 辩论整体失败 → debateResults 保持为空 → 逐币循环中降级为 Solo 模式
          this.logger.warn('[自动交易] Debate 降级为 Solo 模式逐币分析');
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // 【深研策略 — research 模式】
      //
      // 工作方式：真正的多轮角色扮演辩论，分三个 Stage：
      //   Stage 2: 投资辩论 —— Analyst / TechTrader / MacroStrategist / RiskManager / Contrarian
      //            5 个角色轮流发言，进行 maxRounds 轮辩论
      //   Stage 3: 风控辩论 —— Aggressive / Conservative / Neutral + Judge 裁决
      //            进行 riskRounds 轮风控对抗，判断仓位/杠杆是否合理
      //   Stage 4: 共识投票 —— 所有参与模型最终投票，决出最终动作
      // 调用路径：DebateOrchestratorService.runFullDebate()（逐币调用，非多币种批处理）
      //
      // ⚠ 注意：debateConfig.maxRounds（投资辩论轮次）和 riskRounds（风控辩论轮次）
      //   在此模式下真正生效。共识策略（debate 模式）中这两个参数无实质作用。
      //
      // 与共识策略（debate）的关键区别：
      //   - debate（共识）: 模型独立思考 → 投票聚合（无角色扮演，无多轮辩论）
      //   - research（深研）: 5角色投资辩论 + 风控辩论 + 最终共识投票（有角色扮演，有多轮辩论）
      // ═══════════════════════════════════════════════════════════════════════
      if (strategy.tradingMode === 'research' && activeCandidates.length > 0) {
        const debateConfig = strategy.debateConfig as DebateConfig | null;
        this.logger.log(
          `🔬 深研策略(research): ${activeCandidates.length} 个候选币, ${models.length} 模型, ` +
          `投资辩论${debateConfig?.maxRounds || 3}轮, 风控辩论${debateConfig?.riskRounds || 3}轮, 时间框架=${timeframe}`,
        );
        for (const sym of activeCandidates) {
          try {
            const researchConfig: OrchestratorConfig = {
              userId,
              strategyId: strategy.id,
              symbol: sym,
              timeframe,
              secondaryTimeframe,
              models,
              apiKeys,
              maxRounds: debateConfig?.maxRounds || 3,
              riskRounds: debateConfig?.riskRounds || 3,
              temperature: debateConfig?.temperature || 0.7,
            };
            const researchResult = await this.orchestrator.runFullDebate(researchConfig);
            result.totalCost += researchResult.totalCost;
            debateResults.set(sym, {
              decision: researchResult.decision,
              cost: 0, // 已统一计入 result.totalCost
              consensusScore: researchResult.consensusScore,
              consensusVotes: researchResult.votes.map(v => ({
                modelId: v.modelId,
                action: v.decision.action,
                confidence: v.decision.confidence,
                reasoning: v.decision.reasoning || '',
                weight: v.weight,
                success: v.success,
                error: v.error,
                leverage: v.decision.leverage,
                positionSizePercent: v.decision.positionSizePercent,
                stopLoss: v.decision.stopLoss ?? null,
                takeProfit: v.decision.takeProfit ?? null,
              })),
            });
            this.logger.log(
              `[深研] ${sym}: ${researchResult.decision.action} ` +
              `(conf=${researchResult.decision.confidence}%, score=${researchResult.consensusScore}/${models.length})`,
            );
          } catch (error) {
            this.logger.error(`[深研] ${sym} 深研分析失败: ${error.message}`);
            result.errors++;
            // 失败 → 不填入 debateResults → 逐币循环降级 Solo
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // 【极速策略 — quick/Solo 模式（默认）】
      //
      // 条件：tradingMode 既不是 'debate' 也不是 'research'
      // 工作方式：单模型逐币快速分析，无投票/无辩论，每币一次 LLM 调用。
      // 调用路径：QuickAnalysisService.analyze()（逐币循环调用，见下方 for 循环）
      //
      // ⚠ 注意：此 if 块仅打印提示日志，实际 Solo 分析在下方 for 循环的 else 分支执行。
      //   共识策略（debate）和深研策略（research）在上方各自的 if 块中完成预处理，
      //   结果存入 debateResults Map，下方 for 循环中通过 debateResults.has(symbol) 判断分支。
      // ═══════════════════════════════════════════════════════════════════════
      if (strategy.tradingMode !== 'debate' && strategy.tradingMode !== 'research') {
        this.logger.log(
          `🤖 极速策略(全局分析): ${activeCandidates.length} 个候选币, 模型=${quickModel}, ` +
          `时间框架=${timeframe}/${secondaryTimeframe}`,
        );

        // 对齐 nofx: 一次 AI 调用分析所有候选币（全局优化，替代逐币循环）
        // analyzeMultiCoin 已有完整实现：合并所有币 prompt + 单次 LLM + 解析多决策数组 + 降级兜底
        const promptSections = strategy.promptSections as PromptSections | null;
        const multiConfigs: QuickAnalysisConfig[] = activeCandidates.map(sym => ({
          userId,
          symbol: sym,
          timeframe,
          secondaryTimeframe,
          modelId: quickModel,
          apiKeys,
          recentTrades,
          tradingStats,
          accountInfo,
          lastDecisions,
          coinSourceMode: coinSourceConfig.mode,
          candidateSymbols: activeCandidates,
          cycleCount: strategy.cycleCount || undefined,
          runtimeMinutes: strategyRuntimeMin,
          promptConfig: {
            promptSections: promptSections ? {
              role: promptSections.role,
              mode: promptSections.mode,
              custom: promptSections.custom,
            } : undefined,
            riskControl: {
              maxPositions: riskControl.maxPositions,
              maxLeverage: riskControl.maxLeverage,
              btcEthMaxLeverage: riskControl.btcEthMaxLeverage,
              altcoinMaxLeverage: riskControl.altcoinMaxLeverage,
              minRiskRewardRatio: riskControl.minRiskRewardRatio,
              minConfidence: riskControl.minConfidence,
              minPositionSize: riskControl.minPositionSize,
              btcEthMaxPositionValueRatio: riskControl.btcEthMaxPositionValueRatio,
              altcoinMaxPositionValueRatio: riskControl.altcoinMaxPositionValueRatio,
              maxDailyDrawdown: riskControl.maxDailyDrawdown || maxDailyDrawdown,
              allocatedCapital: riskControl.allocatedCapital,
              maxDailyTrades: riskControl.maxDailyTrades,
              cooldownMinutes: riskControl.cooldownMinutes,
              circuitBreaker: riskControl.circuitBreaker,
            },
            intervalMinutes: strategy.intervalMinutes || 60,
            todayTrades: closedToday.length,
            locale,
          },
        }));

        try {
          const multiResults = await this.quickAnalysis.analyzeMultiCoin(multiConfigs);
          let multiTotalCost = 0;

          // 将结果存入 debateResults Map，后续 for 循环统一处理
          for (const [sym, analysisResult] of multiResults) {
            multiTotalCost += analysisResult.cost;
            debateResults.set(sym, {
              decision: analysisResult.decision,
              cost: analysisResult.cost,
              consensusScore: models.length, // Solo 满分
              consensusVotes: [],
            });
            // 保存市场快照供安全检查
            debateMarketSnapshots[sym] = {
              currentPrice: analysisResult.currentPrice ?? 0,
              fundingRate: analysisResult.fundingRate,
              volume24h: analysisResult.volume24h,
              indicators: {
                rsi: analysisResult.indicators?.rsi ?? null,
                atr3: analysisResult.indicators?.atr3 ?? null,
                atr14: analysisResult.indicators?.atr14 ?? null,
              },
            };
            // 保存完整结果供日志透明化
            quickGlobalResults.set(sym, {
              rawResponse: analysisResult.rawResponse,
              systemPrompt: analysisResult.systemPrompt,
              userPrompt: analysisResult.userPrompt,
              analysis: analysisResult.analysis,
              aiThinking: analysisResult.aiThinking,
              marketSnapshot: analysisResult.marketSnapshot,
            });
          }
          result.totalCost += multiTotalCost;
          this.logger.log(
            `🤖 全局分析完成: ${multiResults.size}/${activeCandidates.length} 个币种, 成本=$${multiTotalCost.toFixed(6)}`,
          );
        } catch (e: any) {
          this.logger.error(`[极速] 全局分析失败，降级到逐币模式: ${e.message}`);
          // 降级：不设 debateResults，后续 for 循环走 else 分支（逐币分析）
        }
      }

      // 对齐 nofx sortDecisionsByPriority: close 优先执行，释放保证金后再 open
      // 极速/共识/深研模式下 debateResults 已有所有决策，据此排序 activeCandidates
      if (debateResults.size > 0) {
        const getActionPriority = (action: string): number => {
          if (action === 'close_long' || action === 'close_short') return 1;
          if (action === 'open_long' || action === 'open_short') return 2;
          return 3; // hold, wait
        };
        activeCandidates.sort((a, b) => {
          const actA = debateResults.get(a)?.decision?.action || 'wait';
          const actB = debateResults.get(b)?.decision?.action || 'wait';
          return getActionPriority(actA) - getActionPriority(actB);
        });
        this.logger.log(
          `🔄 执行顺序(对齐nofx): 平仓优先 → [${activeCandidates.map(s => {
            const act = debateResults.get(s)?.decision?.action || '?';
            return `${s.replace(/\/USDT.*$/, '')}:${act}`;
          }).join(', ')}]`,
        );
      }

      // 收集所有币种的决策和执行结果（循环外统一写一条合并日志，对齐 nofx saveDecision 模式）
      const cycleDecisions: Array<{
        symbol: string;
        decision: any;
        executed: boolean;
        executionResult: any;
        analysis?: string;    // 整体市场分析（<reasoning>标签，合并时写入顶层）
        marketSnapshot?: any;
        aiThinking?: string;
        rawResponse?: string;
        systemPrompt?: string;
        userPrompt?: string;
      }> = [];
      // 共享的 prompt 数据（多币种模式下取第一个币种的）
      let sharedRawResponse: string | undefined;
      let sharedSystemPrompt: string | undefined;
      let sharedUserPrompt: string | undefined;

      for (const symbol of activeCandidates) {
        try {
          // 检查是否已有该币种的持仓（已有则跳过开仓，允许平仓决策）
          // 交易所实时持仓全部是 open 状态，无需检查 status
          const hasPosition = existingPositions.some(
            (p) => p.symbol === symbol,
          );

          // Step 6: AI 决策
          let decision: AiTradeDecision;
          let cost = 0;
          let debateConsensusScore = models.length; // Solo 模式默认满分 = 模型数（跳过 L2 共识检查）
          let consensusVotes: ConsensusVote[] | undefined; // Debate 模式各模型投票详情
          // Solo 模式日志透明化：保存 prompt 数据，供后续 aiStrategyLog.create 写入
          let _logRawResponse: string | undefined;
          let _logSystemPrompt: string | undefined;
          let _logUserPrompt: string | undefined;
          let _logAnalysis: string | undefined;   // AI 整体市场分析（对齐网格 analysis）
          let _logAiThinking: string | undefined;  // DeepSeek 思考链（response.thinking）
          let _logMarketSnapshot: any;

          // R4: 提前获取订单簿数据供 AI 决策参考
          let symbolLiquidityData: QuickAnalysisConfig['liquidityData'];
          try {
            const book = await this.marketData.fetchOrderBook(symbol);
            const refSize = (riskControl.allocatedCapital || 1000) * 0.1 * (riskControl.maxLeverage || 10); // 10%仓位×最大杠杆
            const slippageEst = this.marketData.estimateSlippage(book, 'buy', refSize);
            const bestBid = book.bids[0]?.[0] || 0;
            const bestAsk = book.asks[0]?.[0] || 0;
            const spread = bestBid && bestAsk ? ((bestAsk - bestBid) / bestBid) * 100 : 0;
            symbolLiquidityData = [{
              symbol,
              depthUSD: slippageEst.depthUSD,
              estimatedSlippage: slippageEst.estimatedSlippage,
              referenceSizeUSD: Math.round(refSize),
              canFill: slippageEst.canFill,
              spread: Math.round(spread * 1000) / 1000,
            }];
          } catch (e: any) {
            this.logger.debug(`[R4] ${symbol}: 订单簿预获取失败(非致命): ${e.message}`);
          }

          // 风控数据: 从 Solo 分析结果或 Debate 市场快照中获取，供 safety.service 使用
          let safetyIndicators: { rsi: number | null; atr3?: number | null; atr14?: number | null } | undefined;
          let safetyFundingRate: number | undefined;
          let safetyCurrentPrice: number | undefined;
          let safetyVolume24h: number | undefined;
          let safetyPriceChange1h: number | undefined;

          // ── 分支判断：共识/深研策略（预处理已完成）vs 极速策略（此处实时调用）──
          // debateResults 在上方的 if(debate) / if(research) 块中填入
          // 极速策略从未进入那两个块，所以 debateResults.has(symbol) === false
          if (debateResults.has(symbol)) {
            // 【极速全局分析 or 共识策略 or 深研策略】— 决策已在上方预处理完成，此处仅取结果
            // solo:     结果由 QuickAnalysisService.analyzeMultiCoin() 产出（全局一次 LLM）
            // debate:   结果由 ConsensusService.runMultiCoinConsensus() 产出（N模型投票）
            // research: 结果由 DebateOrchestratorService.runFullDebate() 产出（多轮辩论）
            const debateData = debateResults.get(symbol)!;
            decision = debateData.decision;
            cost = debateData.cost; // 0（已在辩论预处理阶段统一计入 result.totalCost）
            debateConsensusScore = debateData.consensusScore;
            consensusVotes = debateData.consensusVotes;
            // 从编排器预获取的市场数据快照填充安全检查数据（L3 RSI/L8 资金费率/L9 ATR+R:R）
            const snapshot = debateMarketSnapshots[symbol];
            if (snapshot) {
              safetyIndicators = snapshot.indicators;
              safetyFundingRate = snapshot.fundingRate;
              safetyCurrentPrice = snapshot.currentPrice;
              safetyVolume24h = snapshot.volume24h;
              safetyPriceChange1h = snapshot.priceChange1h;
            }
            // 极速全局分析模式：从 quickGlobalResults 取日志透明化数据
            const qgr = quickGlobalResults.get(symbol);
            if (qgr) {
              _logRawResponse = qgr.rawResponse;
              _logSystemPrompt = qgr.systemPrompt;
              _logUserPrompt = qgr.userPrompt;
              _logAnalysis = qgr.analysis;
              _logAiThinking = qgr.aiThinking;
              _logMarketSnapshot = qgr.marketSnapshot;
            }
          } else {
            // 【极速策略】or 【共识/深研降级兜底】— 单模型实时分析
            // 极速策略：每币一次 QuickAnalysis（单模型，无投票，无辩论）
            // 降级兜底：共识/深研整体失败时，debateResults 为空，此处接管逐币处理
            const promptSections = strategy.promptSections as PromptSections | null;
            const analysisConfig: QuickAnalysisConfig = {
              userId,
              symbol,
              timeframe,
              secondaryTimeframe,
              modelId: quickModel,
              apiKeys,
              recentTrades,
              tradingStats,
              liquidityData: symbolLiquidityData,
              accountInfo,
              lastDecisions,
              coinSourceMode: coinSourceConfig.mode,
              candidateSymbols: activeCandidates,
              cycleCount: strategy.cycleCount || undefined,
              runtimeMinutes: strategyRuntimeMin,
              promptConfig: {
                promptSections: promptSections ? {
                  role: promptSections.role,
                  mode: promptSections.mode,
                  custom: promptSections.custom,
                } : undefined,
                riskControl: {
                  maxPositions: riskControl.maxPositions,
                  maxLeverage: riskControl.maxLeverage,
                  btcEthMaxLeverage: riskControl.btcEthMaxLeverage,
                  altcoinMaxLeverage: riskControl.altcoinMaxLeverage,
                  minRiskRewardRatio: riskControl.minRiskRewardRatio,
                  minConfidence: riskControl.minConfidence,
                  minPositionSize: riskControl.minPositionSize,
                  btcEthMaxPositionValueRatio: riskControl.btcEthMaxPositionValueRatio,
                  altcoinMaxPositionValueRatio: riskControl.altcoinMaxPositionValueRatio,
                  maxDailyDrawdown: riskControl.maxDailyDrawdown || maxDailyDrawdown,
                  allocatedCapital: riskControl.allocatedCapital,
                  maxDailyTrades: riskControl.maxDailyTrades,
                  cooldownMinutes: riskControl.cooldownMinutes,
                  circuitBreaker: riskControl.circuitBreaker,
                },
                intervalMinutes: strategy.intervalMinutes || 60,
                todayTrades: closedToday.length,
  
                locale,
              },
            };
            this.logger.log(`🤖 [${symbol}] 极速分析中... [QuickAnalysis]`);
            const _soloT0 = Date.now();
            const analysisResult = await this.quickAnalysis.analyze(analysisConfig);
            const _soloDurationSec = ((Date.now() - _soloT0) / 1000).toFixed(1);
            cost = analysisResult.cost;
            decision = analysisResult.decision;
            safetyIndicators = analysisResult.indicators;
            safetyFundingRate = analysisResult.fundingRate;
            safetyCurrentPrice = analysisResult.currentPrice;
            safetyVolume24h = analysisResult.volume24h;
            // 日志透明化：存储 prompt 数据供后续写入 DB
            _logRawResponse = analysisResult.rawResponse;
            _logSystemPrompt = analysisResult.systemPrompt;
            _logUserPrompt = analysisResult.userPrompt;
            _logAnalysis = analysisResult.analysis;
            _logAiThinking = analysisResult.aiThinking;
            _logMarketSnapshot = analysisResult.marketSnapshot;
            this.logger.log(
              `⏱️ [${symbol}] AI 响应耗时 ${_soloDurationSec}s → ${decision.action} (conf=${decision.confidence}%, lev=${decision.leverage}x, pos=${decision.positionSizePercent}%)\n` +
              `  SL=${decision.stopLoss ?? 'none'} TP=${decision.takeProfit ?? 'none'} 成本=$${cost.toFixed(6)}\n` +
              `  分析: ${decision.reasoning || ''}`,
            );
          }

          // priceChange1h 黑天鹅拦截（Solo + Debate 共用，Debate 快照不含此字段）
          // OHLCV 有 5min 缓存，Debate 路径命中缓存，重复调用成本极低
          if (safetyPriceChange1h === undefined) {
            try {
              safetyPriceChange1h = await this.marketData.fetchPriceChange1h(symbol);
            } catch {
              // 非致命，priceChange1h 缺失时 L9 跳过黑天鹅检查
            }
          }

          // E2: 杠杆 auto-clamp（分 BTC/ETH 和山寨币：btcEthMaxLeverage / altcoinMaxLeverage）
          if (decision.leverage) {
            const bs = symbol.split('/')[0]?.toUpperCase();
            const isMaj = bs === 'BTC' || bs === 'ETH';
            const effectiveMaxLev = isMaj
              ? (riskControl.btcEthMaxLeverage ?? riskControl.maxLeverage ?? 5)
              : (riskControl.altcoinMaxLeverage ?? riskControl.maxLeverage ?? 5);
            if (decision.leverage > effectiveMaxLev) {
              this.logger.warn(
                `[风控-E2] ${symbol}: 杠杆 ${decision.leverage}x > ${effectiveMaxLev}x (${isMaj ? 'BTC/ETH' : 'altcoin'})，auto-clamp`,
              );
              decision = { ...decision, leverage: effectiveMaxLev };
            }
          }

          result.analyzed++;
          result.totalCost += cost;

          // wait/hold: 不需要安全检查，直接记录日志跳过
          if (decision.action === 'hold' || decision.action === 'wait') {
            this.logger.log(
              `[自动交易] 决策摘要: ${symbol} → ${decision.action} (confidence=${decision.confidence}%)\n` +
              `  ⏸ AI 建议 "${decision.action}"，跳过执行`,
            );
            result.decisions.push({
              symbol,
              action: decision.action,
              confidence: decision.confidence,
              executed: false,
            });
            cycleDecisions.push({
              symbol,
              decision: {
                action: decision.action,
                confidence: decision.confidence,
                leverage: decision.leverage,
                positionSizePercent: decision.positionSizePercent,
                ...(decision.positionSizeUSD ? { positionSizeUSD: decision.positionSizeUSD } : {}),
                // reasoning = 该币 JSON 短摘要（不被整体分析覆盖）
                reasoning: decision.reasoning,
                ...(strategy.tradingMode !== 'debate' ? { modelId: quickModel } : {}),
                ...(consensusVotes ? { votes: consensusVotes } : {}),
                ...(_logAiThinking ? { aiThinking: _logAiThinking } : {}),
                ...(_logMarketSnapshot ? { marketSnapshot: _logMarketSnapshot } : {}),
              },
              // 整体分析单独存，合并日志时写入顶层 reasoning
              analysis: _logAnalysis,
              executed: false,
              executionResult: { skipped: true, reason: decision.action },
              marketSnapshot: _logMarketSnapshot,
              aiThinking: _logAiThinking,
              rawResponse: _logRawResponse,
              systemPrompt: _logSystemPrompt,
              userPrompt: _logUserPrompt,
            });
            if (!sharedRawResponse) {
              sharedRawResponse = _logRawResponse;
              sharedSystemPrompt = _logSystemPrompt;
              sharedUserPrompt = _logUserPrompt;
            }
            this.gateway.sendAiDecision(userId, {
              strategyId, symbol, action: decision.action,
              confidence: decision.confidence,
              reasoning: decision.reasoning,
              source: 'ai_strategy', status: 'skipped',
              timestamp: new Date().toISOString(),
            });
            continue;
          }

          // 如果已有持仓且决策是开仓方向，跳过
          if (hasPosition && (decision.action === 'open_long' || decision.action === 'open_short')) {
            this.logger.log(
              `[自动交易] 决策摘要: ${symbol} → ${decision.action} (confidence=${decision.confidence}%, consensusScore=${debateConsensusScore}/${models.length})\n` +
              `  ⏸ 已有持仓，跳过开仓`,
            );
            result.decisions.push({
              symbol,
              action: decision.action,
              confidence: decision.confidence,
              executed: false,
              error: '已有持仓，跳过开仓',
            });

            // WebSocket: 推送已有持仓跳过
            this.gateway.sendAiDecision(userId, {
              strategyId, symbol, action: decision.action, confidence: decision.confidence,
              reasoning: '已有持仓，跳过开仓',
              source: 'ai_strategy',
              status: 'skipped', blockedBy: 'has_position',
              timestamp: new Date().toISOString(),
            });
            continue;
          }

          // === minConfidence 代码级预过滤（默认 60，用户可配置）===
          // RiskControlConfig.minConfidence 默认 60，用户可在策略 riskControlConfig 中调整
          {
            const isOpenDecision = decision.action === 'open_long' || decision.action === 'open_short';
            const minConf = riskControl.minConfidence ?? 60;
            if (isOpenDecision && decision.confidence < minConf) {
              this.logger.log(
                `[风控] ${symbol}: confidence ${decision.confidence}% < minConfidence ${minConf}%，强制转为 wait`,
              );
              decision = { ...decision, action: 'wait' as AiAction };
              // 转为 wait 后进入跳过流程
              result.decisions.push({ symbol, action: 'wait', confidence: decision.confidence, executed: false });
              cycleDecisions.push({
                symbol,
                decision: {
                  action: 'wait',
                  confidence: decision.confidence,
                  minConfFilter: true,
                  actual: decision.confidence,
                  required: minConf,
                  originalAction: decision.action,
                  reasoning: `[置信度不足 ${decision.confidence}%<${minConf}%，未执行] ${decision.reasoning || ''}`,
                },
                executed: false,
                executionResult: { skipped: true, reason: 'min_confidence' },
                rawResponse: _logRawResponse,
                systemPrompt: _logSystemPrompt,
                userPrompt: _logUserPrompt,
              });
              if (!sharedRawResponse) {
                sharedRawResponse = _logRawResponse;
                sharedSystemPrompt = _logSystemPrompt;
                sharedUserPrompt = _logUserPrompt;
              }
              continue;
            }
          }

          // === 持仓一致性检查：无持仓的币不能输出 hold/close ===
          {
            const hasPosition = thisStrategyOpenPositions.some(p => p.symbol === symbol);
            const act = decision.action as string;
            if (!hasPosition && (act === 'hold' || act === 'close_long' || act === 'close_short')) {
              this.logger.warn(`[修正] ${symbol}: AI 输出 ${decision.action} 但无持仓，修正为 wait`);
              decision = { ...decision, action: 'wait' as AiAction };
            }
          }

          // Step 7: 安全检查
          // Solo 模式: consensusScore = 5（满分），跳过 L2 共识检查
          // Debate 模式: 使用辩论的实际共识得分（0-5）

          // 从 AI 决策的绝对价格计算 SL/TP 百分比 + 方向验证（safety.service L9 R:R 检查需要）
          let takeProfitPercent: number | undefined;
          let stopLossPercent: number | undefined;
          let stopLossValid: boolean | undefined;
          let takeProfitValid: boolean | undefined;
          if (safetyCurrentPrice && safetyCurrentPrice > 0) {
            const isLongAction = decision.action === 'open_long';
            const isShortAction = decision.action === 'open_short';
            if (decision.stopLoss != null) {
              const slDiff = decision.stopLoss - safetyCurrentPrice;
              stopLossPercent = Math.abs(slDiff) / safetyCurrentPrice * 100;
              // 方向验证：long 的 SL 须低于当前价（slDiff<0），short 须高于当前价（slDiff>0）
              if (isLongAction) stopLossValid = slDiff < 0;
              else if (isShortAction) stopLossValid = slDiff > 0;
            }
            if (decision.takeProfit != null) {
              const tpDiff = decision.takeProfit - safetyCurrentPrice;
              takeProfitPercent = Math.abs(tpDiff) / safetyCurrentPrice * 100;
              // 方向验证：long 的 TP 须高于当前价（tpDiff>0），short 须低于当前价（tpDiff<0）
              if (isLongAction) takeProfitValid = tpDiff > 0;
              else if (isShortAction) takeProfitValid = tpDiff < 0;
            }
          }

          // 计算实际仓位金额（USD），供 L10 流动性检查比较
          const allocCap = riskControl.allocatedCapital || 1000;
          const positionSizeUSD = decision.positionSizeUSD
            ? decision.positionSizeUSD  // USD 模式：直接用
            : allocCap * (decision.positionSizePercent / 100) * (decision.leverage || 1);

          const safetyInput: SafetyCheckInput = {
            userId,
            symbol,
            direction: this.actionToDirection(decision.action),
            action: decision.action,
            confidence: decision.confidence,
            consensusScore: debateConsensusScore,
            positionSize: decision.positionSizePercent,
            leverage: decision.leverage,
            totalModels: models.length,
            mode: strategy.strategyType === 'debate' ? 'consensus' : 'quick', // Solo 跳过 L2；Debate 启用 L2 兜底（需 3/5 同意）
            // 风控指标数据（Solo 由 quick-analysis 返回，Debate 由编排器市场快照提供）
            indicators: safetyIndicators as SafetyCheckInput['indicators'],
            fundingRate: safetyFundingRate,
            volume24h: safetyVolume24h,
            priceChange1h: safetyPriceChange1h, // L9 黑天鹅检测
            positionSizeUSD,
            takeProfitPercent,
            stopLossPercent,
            stopLossPrice: decision.stopLoss ?? undefined,    // 对齐 nofx: SL 绝对价格
            takeProfitPrice: decision.takeProfit ?? undefined, // 对齐 nofx: TP 绝对价格
            stopLossValid,    // SL 方向验证结果
            takeProfitValid,  // TP 方向验证结果
            currentPrice: safetyCurrentPrice,
            strategyId, // L9 按策略独立计算持仓数
            // 策略级风控参数
            strategyRiskConfig: {
              maxLeverage: riskControl.maxLeverage,
              btcEthMaxLeverage: riskControl.btcEthMaxLeverage,
              altcoinMaxLeverage: riskControl.altcoinMaxLeverage,
              minRiskRewardRatio: riskControl.minRiskRewardRatio,
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

          // L4 自动削减：positionSize 和杠杆超限均 clip 不拒绝
          if (safetyResult.adjustedPositionSizePct !== undefined || safetyResult.adjustedLeverage !== undefined) {
            const clips: string[] = [];
            if (safetyResult.adjustedPositionSizePct !== undefined) {
              clips.push(`positionSize ${decision.positionSizePercent}%→${safetyResult.adjustedPositionSizePct}%`);
              decision = { ...decision, positionSizePercent: safetyResult.adjustedPositionSizePct };
            }
            if (safetyResult.adjustedLeverage !== undefined) {
              clips.push(`leverage ${decision.leverage}x→${safetyResult.adjustedLeverage}x`);
              decision = { ...decision, leverage: safetyResult.adjustedLeverage };
            }
            this.logger.warn(`[风控-L4] ${symbol} 自动削减: ${clips.join(', ')}`);
          }

          // 安全检查逐层摘要
          const checkSummary = safetyResult.checks
            .map(c => `${c.layer}:${c.passed ? '✓' : '✗'}`)
            .join(' ');
          this.logger.log(
            `[安全检查] ${symbol} [${checkSummary}]` +
            (safetyResult.warnings.length > 0 ? ` 警告(${safetyResult.warnings.length}): ${safetyResult.warnings[0]?.slice(0, 80)}` : ''),
          );

          if (!safetyResult.passed) {
            this.logger.log(
              `[自动交易] 决策摘要: ${symbol} → ${decision.action} (confidence=${decision.confidence}%, consensusScore=${debateConsensusScore}/${models.length}, leverage=${decision.leverage}x, posPct=${decision.positionSizePercent}%)\n` +
              `  🚫 安全检查拦截: ${safetyResult.blockedBy} — ${safetyResult.blockedReason}\n` +
              `  SL=${decision.stopLoss ?? 'none'} TP=${decision.takeProfit ?? 'none'}`,
            );
            result.decisions.push({
              symbol,
              action: decision.action,
              confidence: decision.confidence,
              executed: false,
              error: `Safety: ${safetyResult.blockedReason}`,
            });

            // 收集安全检查失败到合并日志
            const safetyCapitalUSD = (decision.action === 'open_long' || decision.action === 'open_short')
              ? Math.round(decision.positionSizeUSD ?? (allocCap * (decision.positionSizePercent || 0) / 100)) : undefined;
            cycleDecisions.push({
              symbol,
              decision: {
                action: decision.action,
                confidence: decision.confidence,
                leverage: decision.leverage,
                positionSizePercent: decision.positionSizePercent,
                ...(decision.positionSizeUSD ? { positionSizeUSD: decision.positionSizeUSD } : {}),
                ...(safetyCapitalUSD != null ? { capitalUSD: safetyCapitalUSD } : {}),
                stopLoss: decision.stopLoss,
                takeProfit: decision.takeProfit,
                reasoning: decision.reasoning,
                ...(strategy.tradingMode !== 'debate' ? { modelId: quickModel } : {}),
                ...(consensusVotes ? { votes: consensusVotes } : {}),
                ...(_logAiThinking ? { aiThinking: _logAiThinking } : {}),
                ...(_logMarketSnapshot ? { marketSnapshot: _logMarketSnapshot } : {}),
              },
              analysis: _logAnalysis,
              executed: false,
              executionResult: {
                blocked: true,
                blockedBy: safetyResult.blockedBy,
                reason: safetyResult.blockedReason,
              },
              marketSnapshot: _logMarketSnapshot,
              aiThinking: _logAiThinking,
              rawResponse: _logRawResponse,
              systemPrompt: _logSystemPrompt,
              userPrompt: _logUserPrompt,
            });
            if (!sharedRawResponse) {
              sharedRawResponse = _logRawResponse;
              sharedSystemPrompt = _logSystemPrompt;
              sharedUserPrompt = _logUserPrompt;
            }

            // WebSocket: 推送安全检查拦截的决策
            this.gateway.sendAiDecision(userId, {
              strategyId,
              symbol,
              action: decision.action,
              confidence: decision.confidence,
              leverage: decision.leverage,
              reasoning: `安全拦截: ${safetyResult.blockedReason}`,
              source: 'ai_strategy',
              status: 'blocked',
              blockedBy: safetyResult.blockedBy || 'safety',
              stopLoss: decision.stopLoss, takeProfit: decision.takeProfit,
              positionSizePercent: decision.positionSizePercent,
                  ...(decision.positionSizeUSD ? { positionSizeUSD: decision.positionSizeUSD } : {}),
              timestamp: new Date().toISOString(),
            });
            continue;
          }

          allDecisions.push({
            symbol, decision, passed: true, cost,
            consensusScore: debateConsensusScore, consensusVotes,
            rawResponse: _logRawResponse,
            systemPrompt: _logSystemPrompt,
            userPrompt: _logUserPrompt,
            analysis: _logAnalysis,
            aiThinking: _logAiThinking,
            marketSnapshot: _logMarketSnapshot,
          });
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

      // LOG-6: 执行顺序预览
      if (sortedDecisions.length > 0) {
        const orderList = sortedDecisions
          .map((d, i) => `  [${i + 1}] ${d.symbol} ${d.decision.action} (conf=${d.decision.confidence}%)`)
          .join('\n');
        this.logger.log(
          `${'-'.repeat(70)}\n` +
          `🔄 执行顺序 (平仓优先→开仓): ${sortedDecisions.length} 个决策\n` +
          orderList,
        );
      }

      // Step 8.5: 获取交易所实际可用余额，用于 D6/E4 预检
      // 避免 allocatedCapital=1000 但实际余额只有 $13 导致 E4 误放行
      let realAvailableBalance: number | undefined;
      if (sortedDecisions.some(d => d.decision.action === 'open_long' || d.decision.action === 'open_short')) {
        try {
          realAvailableBalance = await this.aiExecution.getAvailableBalance(
            userId, effectiveExchangeApiKeyId, riskControl.allocatedCapital,
          );
          this.logger.log(`[自动交易] 实际可用余额: $${realAvailableBalance.toFixed(2)}`);
        } catch (e) {
          this.logger.warn(`[自动交易] 获取余额失败，E4 回退到 allocatedCapital`);
        }
      }

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

        const { symbol, consensusVotes: votes, rawResponse: itemRawResponse, systemPrompt: itemSystemPrompt, userPrompt: itemUserPrompt, aiThinking: itemAiThinking, marketSnapshot: itemMarketSnapshot } = item;
        let decision = item.decision; // R3: let 允许执行时价格刷新重算 SL/TP

        // D7: 排除币种检查
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

        // hold/wait 已在安全检查之前提前分流（L785 上方），此处不再需要

        try {
          // D6: positionValueRatio auto-cap（超限时自动缩小到上限，不拦截交易）
          if (decision.action === 'open_long' || decision.action === 'open_short') {
            const baseSymbol = symbol.split('/')[0]?.toUpperCase();
            const isMajor = baseSymbol === 'BTC' || baseSymbol === 'ETH';
            const maxRatio = isMajor
              ? (riskControl.btcEthMaxPositionValueRatio ?? 5.0)
              : (riskControl.altcoinMaxPositionValueRatio ?? 1.0);
            const allocCap = realAvailableBalance ?? (riskControl.allocatedCapital || 1000);
            const posValueEst = decision.positionSizeUSD
              ? decision.positionSizeUSD
              : (decision.positionSizePercent / 100) * allocCap * decision.leverage;
            const maxPosValue = allocCap * maxRatio;
            if (posValueEst > maxPosValue) {
              if (decision.positionSizeUSD) {
                this.logger.warn(
                  `[风控-D6] ${symbol}: 仓位 $${posValueEst.toFixed(0)} 超限 $${maxPosValue.toFixed(0)}, auto-cap → $${maxPosValue.toFixed(0)}`,
                );
                decision = { ...decision, positionSizeUSD: maxPosValue };
              } else {
                const cappedPercent = (maxPosValue / (allocCap * decision.leverage)) * 100;
                this.logger.warn(
                  `[风控-D6] ${symbol}: 仓位 $${posValueEst.toFixed(0)} 超限 $${maxPosValue.toFixed(0)}, auto-cap ${decision.positionSizePercent}% → ${cappedPercent.toFixed(1)}%`,
                );
              decision = { ...decision, positionSizePercent: Math.max(cappedPercent, 1) };
              }
            }
          }

          // E4: 最小仓位检查（用户可配 minPositionSize）
          // 用户配置 > 系统硬底 ($12 山寨/$60 BTC/ETH)
          if (decision.action === 'open_long' || decision.action === 'open_short') {
            const bs = symbol.split('/')[0]?.toUpperCase();
            const isMaj = bs === 'BTC' || bs === 'ETH';
            const allocCap = realAvailableBalance ?? (riskControl.allocatedCapital || 1000);
            // 对齐 nofx：优先用 positionSizeUSD（美元绝对值），回退到百分比
            const marginEst = decision.positionSizeUSD
              ? decision.positionSizeUSD / (decision.leverage || 1) // USD 模式：名义值/杠杆=保证金
              : (decision.positionSizePercent / 100) * allocCap;
            const userMinSize = riskControl.minPositionSize ?? AI_SAFETY_DEFAULTS.minPositionSizeAlt;
            const minMargin = isMaj
              ? Math.max(userMinSize, AI_SAFETY_DEFAULTS.minPositionSizeMajor) // BTC/ETH 系统硬底 $60
              : userMinSize; // 山寨币用用户配置值（默认 $12）

            if (marginEst < minMargin * 0.95) {
              const e4Reason = `预估保证金 $${marginEst.toFixed(1)} < 最低 $${(minMargin * 0.95).toFixed(1)} (${isMaj ? 'BTC/ETH' : '山寨币'})`;
              this.logger.warn(`[风控-E4] ${symbol} ${e4Reason}，跳过`);
              result.decisions.push({
                symbol, action: decision.action, confidence: decision.confidence, executed: false, error: `E4: ${e4Reason}`,
              });

              // 收集 E4 拦截到合并日志
              cycleDecisions.push({
                symbol,
                decision: {
                  action: decision.action,
                  confidence: decision.confidence,
                  leverage: decision.leverage,
                  positionSizePercent: decision.positionSizePercent,
                  ...(decision.positionSizeUSD ? { positionSizeUSD: decision.positionSizeUSD } : {}),
                  capitalUSD: Math.round(marginEst),
                  stopLoss: decision.stopLoss,
                  takeProfit: decision.takeProfit,
                  reasoning: decision.reasoning,
                  ...(strategy.tradingMode !== 'debate' ? { modelId: quickModel } : {}),
                  ...(votes ? { votes } : {}),
                },
                executed: false,
                executionResult: { blocked: true, blockedBy: 'E4', reason: e4Reason },
              });
              if (!sharedRawResponse) {
                sharedRawResponse = itemRawResponse;
                sharedSystemPrompt = itemSystemPrompt;
                sharedUserPrompt = itemUserPrompt;
              }

              // WS 通知
              this.gateway.sendAiDecision(userId, {
                strategyId, symbol, action: decision.action, confidence: decision.confidence,
                leverage: decision.leverage,
                reasoning: `风控拦截(E4): ${e4Reason}`, source: 'ai_strategy',
                status: 'blocked', blockedBy: 'E4',
                positionSizePercent: decision.positionSizePercent,
                  ...(decision.positionSizeUSD ? { positionSizeUSD: decision.positionSizeUSD } : {}),
                timestamp: new Date().toISOString(),
              });
              continue;
            }
          }

          // R3: 执行时价格刷新 — 用最新价格重算 SL/TP（辩论耗时 30-60s，价格可能偏移 1-2%）
          // freshPrice 同时传给 executeDecision，避免执行层重复调用 getMarketPrice
          let freshPrice: number | undefined;
          if (decision.stopLossPct && decision.takeProfitPct) {
            try {
              const price = await this.marketData.fetchCurrentPrice(symbol);
              if (price > 0) {
                freshPrice = price;
                const isLongDir = decision.action === 'open_long';
                const oldSL = decision.stopLoss;
                const oldTP = decision.takeProfit;
                decision = {
                  ...decision,
                  stopLoss: isLongDir
                    ? Math.round(price * (1 - decision.stopLossPct) * 100) / 100
                    : Math.round(price * (1 + decision.stopLossPct) * 100) / 100,
                  takeProfit: isLongDir
                    ? Math.round(price * (1 + decision.takeProfitPct) * 100) / 100
                    : Math.round(price * (1 - decision.takeProfitPct) * 100) / 100,
                };
                this.logger.log(
                  `[R3] ${symbol} 价格刷新: SL ${oldSL}→${decision.stopLoss}, TP ${oldTP}→${decision.takeProfit} (freshPrice=$${price})`,
                );
              }
            } catch (e: any) {
              this.logger.warn(`[R3] ${symbol} 价格刷新失败，保留辩论时 SL/TP: ${e.message}`);
            }
          }

          // R4: 滑点安全顶（3% 绝对上限，AI 无法覆盖）
          // 低于 3% 的滑点由 AI 自行判断（订单簿数据已在 prompt 中注入）
          if (decision.action === 'open_long' || decision.action === 'open_short') {
            try {
              const book = await this.marketData.fetchOrderBook(symbol);
              const posUSD = decision.positionSizeUSD
                ? decision.positionSizeUSD
                : (decision.positionSizePercent / 100) * (riskControl.allocatedCapital || 1000) * decision.leverage;
              const slippageEst = this.marketData.estimateSlippage(
                book,
                decision.action === 'open_long' ? 'buy' : 'sell',
                posUSD,
              );

              if (slippageEst.estimatedSlippage > 3.0 || !slippageEst.canFill) {
                // 滑点 > 3% 或深度不足以完全成交 → 硬拦截（AI 无法覆盖）
                const reason = !slippageEst.canFill
                  ? `R4: 深度不足 ($${slippageEst.depthUSD} < 订单$${Math.round(posUSD)})`
                  : `R4: 滑点 ${slippageEst.estimatedSlippage.toFixed(2)}% > 3% 安全顶`;
                this.logger.warn(
                  `[R4] ${symbol}: ${reason} — 硬拦截开仓`,
                );
                result.decisions.push({
                  symbol,
                  action: decision.action,
                  confidence: decision.confidence,
                  executed: false,
                  error: reason,
                });
                cycleDecisions.push({
                  symbol,
                  decision: {
                    action: decision.action, confidence: decision.confidence,
                    leverage: decision.leverage, positionSizePercent: decision.positionSizePercent,
                    ...(decision.positionSizeUSD ? { positionSizeUSD: decision.positionSizeUSD } : {}),
                    stopLoss: decision.stopLoss, takeProfit: decision.takeProfit,
                    reasoning: decision.reasoning,
                  },
                  executed: false,
                  executionResult: { blocked: true, blockedBy: 'R4', reason },
                });
                if (!sharedRawResponse) {
                  sharedRawResponse = itemRawResponse;
                  sharedSystemPrompt = itemSystemPrompt;
                  sharedUserPrompt = itemUserPrompt;
                }
                continue;
              }

              if (slippageEst.estimatedSlippage > 0.5) {
                this.logger.log(
                  `[R4] ${symbol}: 滑点 ${slippageEst.estimatedSlippage.toFixed(4)}% (深度=$${slippageEst.depthUSD}, 订单=$${Math.round(posUSD)}) — AI已知悉`,
                );
              }
            } catch (e: any) {
              this.logger.warn(`[R4] ${symbol}: 订单簿获取失败(非致命): ${e.message}`);
            }
          }

          // 同币种冷却期检查（对齐 nofx：防止震荡市频繁开平同一币种）
          if (decision.action === 'open_long' || decision.action === 'open_short') {
            const cooldownMin = riskControl.cooldownMinutes ?? 5; // 默认 5 分钟冷却
            const recentClose = await this.prisma.position.findFirst({
              where: {
                userId,
                symbol,
                status: 'closed',
                aiStrategyId: strategy.id,
                closedAt: { gte: new Date(Date.now() - cooldownMin * 60 * 1000) },
                closeReason: { notIn: ['manual', 'not_found_on_exchange'] },
              },
              orderBy: { closedAt: 'desc' },
              select: { closedAt: true },
            });
            if (recentClose) {
              const ago = Math.round((Date.now() - recentClose.closedAt!.getTime()) / 60000);
              this.logger.warn(`[冷却期] ${symbol} ${ago}分钟前刚平仓，冷却${cooldownMin}分钟内禁止重新开仓`);
              result.decisions.push({ symbol, action: decision.action, confidence: decision.confidence, executed: false, error: `冷却期: ${ago}min < ${cooldownMin}min` });
              continue;
            }
          }

          // 执行前打印动作前缀
          if (decision.action === 'open_long') {
            this.logger.log(`  📈 开多: ${symbol} (conf=${decision.confidence}%, lev=${decision.leverage}x)`);
          } else if (decision.action === 'open_short') {
            this.logger.log(`  📉 开空: ${symbol} (conf=${decision.confidence}%, lev=${decision.leverage}x)`);
          } else if (decision.action === 'close_long') {
            this.logger.log(`  🔄 平多: ${symbol}`);
          } else if (decision.action === 'close_short') {
            this.logger.log(`  🔄 平空: ${symbol}`);
          }

          // 对齐 nofx：优先传 positionSizeUSD（美元绝对值），回退到 positionSizePercent
          const execResult = await this.aiExecution.executeDecision(
            userId,
            effectiveExchangeApiKeyId,
            {
              symbol,
              action: decision.action,
              confidence: decision.confidence,
              leverage: decision.leverage,
              positionSizeUSD: decision.positionSizeUSD ?? decision.positionSizePercent,
              stopLoss: decision.stopLoss || undefined,
              takeProfit: decision.takeProfit || undefined,
              reasoning: decision.reasoning,
              maxTradeAmountUSD: riskControl.maxTradeAmountUSD,
              allocatedCapital: riskControl.allocatedCapital,
              currentPrice: freshPrice,
              btcEthMaxPositionValueRatio: riskControl.btcEthMaxPositionValueRatio,
              altcoinMaxPositionValueRatio: riskControl.altcoinMaxPositionValueRatio,
            },
            'ai_strategy',
            strategyId,
          );

          if (execResult.success) {
            result.executed++;
            this.logger.log(
              `  ✓ 执行成功: orderId=${execResult.orderId} positionId=${execResult.positionId}\n` +
              `  price=$${execResult.price} amount=${execResult.amount} leverage=${decision.leverage}x`,
            );
            // 记录到熔断器: 成功
            if (this.circuitBreaker) {
              await this.circuitBreaker.recordSuccess(`ai_strategy_${strategyId}`).catch(() => {});
            }
          } else {
            this.logger.warn(
              `❌ 执行失败 (${symbol} ${decision.action}): ${execResult.error}`,
            );
            // 记录到熔断器: 失败
            if (this.circuitBreaker) {
              await this.circuitBreaker.recordFailure(`ai_strategy_${strategyId}`, execResult.error).catch(() => {});
            }
          }

          result.decisions.push({
            symbol,
            action: decision.action,
            confidence: decision.confidence,
            executed: execResult.success,
            error: execResult.error,
          });

          // 收集执行结果到合并日志
          const logAllocCap = riskControl.allocatedCapital || 1000;
          const execCapitalUSD = (decision.action === 'open_long' || decision.action === 'open_short')
            ? Math.round(decision.positionSizeUSD ?? (logAllocCap * (decision.positionSizePercent || 0) / 100)) : undefined;
          cycleDecisions.push({
            symbol,
            decision: {
              action: decision.action,
              confidence: decision.confidence,
              leverage: decision.leverage,
              positionSizePercent: decision.positionSizePercent,
              ...(decision.positionSizeUSD ? { positionSizeUSD: decision.positionSizeUSD } : {}),
              ...(execCapitalUSD != null ? { capitalUSD: execCapitalUSD } : {}),
              stopLoss: decision.stopLoss,
              takeProfit: decision.takeProfit,
              reasoning: decision.reasoning,
              ...(strategy.tradingMode !== 'debate' ? { modelId: quickModel } : {}),
              ...(votes ? { votes } : {}),
              ...(itemAiThinking ? { aiThinking: itemAiThinking } : {}),
              ...(itemMarketSnapshot ? { marketSnapshot: itemMarketSnapshot } : {}),
            },
            executed: execResult.success,
            executionResult: {
              orderId: execResult.orderId,
              positionId: execResult.positionId,
              price: execResult.price,
              amount: execResult.amount,
              error: execResult.error,
              positionValueLimit: execResult.positionValueLimit,
              aiRequestedUSD: execResult.aiRequestedUSD,
              actualNotional: execResult.actualNotional,
              actualMargin: execResult.actualMargin,
              wasTruncated: execResult.wasTruncated,
            },
            marketSnapshot: itemMarketSnapshot,
            aiThinking: itemAiThinking,
            rawResponse: itemRawResponse,
            systemPrompt: itemSystemPrompt,
            userPrompt: itemUserPrompt,
          });
          if (!sharedRawResponse) {
            sharedRawResponse = itemRawResponse;
            sharedSystemPrompt = itemSystemPrompt;
            sharedUserPrompt = itemUserPrompt;
          }

          // LOG-7: 决策记录保存确认
          this.logger.debug(
            `📝 决策记录已保存: ${symbol} ${decision.action}`,
          );

          // WebSocket: 推送决策信息（含执行结果）
          this.gateway.sendAiDecision(userId, {
            strategyId,
            symbol,
            action: decision.action,
            confidence: decision.confidence,
            leverage: decision.leverage,
            reasoning: decision.reasoning,
            source: 'ai_strategy',
            status: execResult.success ? 'executed' : 'failed',
            orderId: execResult.orderId,
            positionId: execResult.positionId,
            price: execResult.price,
            amount: execResult.amount,
            error: execResult.error,
            stopLoss: decision.stopLoss, takeProfit: decision.takeProfit,
            positionSizePercent: decision.positionSizePercent,
                  ...(decision.positionSizeUSD ? { positionSizeUSD: decision.positionSizeUSD } : {}),
            timestamp: new Date().toISOString(),
          });

          // WebSocket: 推送执行结果（含 orderId、成交价、仓位 ID）
          this.gateway.sendAiExecutionResult(userId, {
            strategyId,
            symbol,
            action: decision.action,
            executed: execResult.success,
            orderId: execResult.orderId,
            positionId: execResult.positionId,
            price: execResult.price,
            amount: execResult.amount,
            error: execResult.error,
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

          // 收集执行异常到合并日志
          const failAllocCap = riskControl.allocatedCapital || 1000;
          const failCapitalUSD = (decision.action === 'open_long' || decision.action === 'open_short')
            ? Math.round(decision.positionSizeUSD ?? (failAllocCap * (decision.positionSizePercent || 0) / 100)) : undefined;
          cycleDecisions.push({
            symbol,
            decision: {
              action: decision.action,
              confidence: decision.confidence,
              leverage: decision.leverage,
              positionSizePercent: decision.positionSizePercent,
              ...(decision.positionSizeUSD ? { positionSizeUSD: decision.positionSizeUSD } : {}),
              ...(failCapitalUSD != null ? { capitalUSD: failCapitalUSD } : {}),
              stopLoss: decision.stopLoss,
              takeProfit: decision.takeProfit,
              reasoning: decision.reasoning,
              ...(strategy.tradingMode !== 'debate' ? { modelId: quickModel } : {}),
              ...(votes ? { votes } : {}),
            },
            executed: false,
            executionResult: { error: error.message },
          });
          if (!sharedRawResponse) {
            sharedRawResponse = itemRawResponse;
            sharedSystemPrompt = itemSystemPrompt;
            sharedUserPrompt = itemUserPrompt;
          }

          // WebSocket: 推送执行失败决策
          this.gateway.sendAiDecision(userId, {
            strategyId,
            symbol,
            action: decision.action,
            confidence: decision.confidence,
            reasoning: `执行失败: ${translateExchangeError(error.message)}`,
            source: 'ai_strategy',
            status: 'failed',
            error: translateExchangeError(error.message),
            timestamp: new Date().toISOString(),
          });
        }
      }

      // 对齐 nofx saveDecision(record) 模式：一轮一条合并日志（包含所有币种的决策）
      if (cycleDecisions.length > 0) {
        // 主决策：优先选已执行的，其次选第一个
        const primaryDecision = cycleDecisions.find(d => d.executed) || cycleDecisions[0];
        const primarySymbol = primaryDecision.symbol;

        // 提取共享的整体分析（来自 <reasoning> 标签），用于顶层 reasoning
        const sharedAnalysis = primaryDecision.analysis || cycleDecisions.find(d => d.analysis)?.analysis;

        await db.aiStrategyLog.create({
          data: {
            strategyId,
            symbol: primarySymbol,
            decision: {
              ...primaryDecision.decision,
              // 顶层 reasoning = 整体市场分析（<reasoning>标签），给用户看
              ...(sharedAnalysis ? { reasoning: sharedAnalysis } : {}),
              allDecisions: cycleDecisions.map(d => ({
                symbol: d.symbol,
                ...d.decision,
                // 每币 reasoning = JSON 短摘要（不被整体分析覆盖）
                reasoning: d.decision.reasoning !== sharedAnalysis ? d.decision.reasoning : '',
                executed: d.executed,
                executionResult: d.executionResult,
              })),
            } as unknown as Prisma.InputJsonValue,
            executed: cycleDecisions.some(d => d.executed),
            executionResult: {
              allExecutions: cycleDecisions.map(d => ({
                symbol: d.symbol,
                executed: d.executed,
                ...d.executionResult,
              })),
            },
            rawResponse: sharedRawResponse,
            systemPrompt: sharedSystemPrompt,
            userPrompt: sharedUserPrompt,
          },
        });
      }

      // 更新策略统计 + lastCycleAt + cycleCount + 重置连续失败计数
      result.totalLatencyMs = Date.now() - startTime;

      // 重新计算该策略的交易统计（仅限本策略的已关闭持仓）
      const strategyClosedPositions = await db.position.findMany({
        where: {
          aiStrategyId: strategyId,
          status: 'closed',
          realizedPnl: { not: null },
        },
        select: { realizedPnl: true, margin: true },
      });
      const sTotalTrades = strategyClosedPositions.length;
      const sWins = strategyClosedPositions.filter((p) => Number(p.realizedPnl || 0) > 0);
      const sWinRate = sTotalTrades > 0 ? (sWins.length / sTotalTrades) * 100 : 0;
      const sTotalPnl = strategyClosedPositions.reduce((s, p) => s + Number(p.realizedPnl || 0), 0);
      // 简化夏普率
      const sPnlPcts = strategyClosedPositions.map((p) =>
        Number(p.margin) > 0 ? (Number(p.realizedPnl || 0) / Number(p.margin)) * 100 : 0,
      );
      const sMean = sPnlPcts.length > 0 ? sPnlPcts.reduce((a, b) => a + b, 0) / sPnlPcts.length : 0;
      const sVar = sPnlPcts.length > 1
        ? sPnlPcts.reduce((s, v) => s + (v - sMean) ** 2, 0) / (sPnlPcts.length - 1)
        : 0;
      const sSharpe = Math.sqrt(sVar) > 0 ? (sMean / Math.sqrt(sVar)) * Math.sqrt(365) : 0;

      const updatedStrategy = await db.aiStrategy.update({
        where: { id: strategyId },
        data: {
          lastCycleAt: new Date(),
          cycleCount: { increment: 1 },
          totalTrades: sTotalTrades,
          totalPnl: Number(sTotalPnl.toFixed(8)),
          winRate: Number(sWinRate.toFixed(2)),
          sharpe: Number(sSharpe.toFixed(4)),
          ...(strategy.consecutiveFailures > 0 ? { consecutiveFailures: 0 } : {}),
        },
      });

      // 检查停止条件 (maxCycles / profitTargetPercent / maxLossPercent)
      const stopCond = (strategy.stopConditions as StopConditionsConfig) || {};
      const maxCycles = stopCond.maxCycles || 0;
      let shouldStop = false;
      let stopReason = '';

      if (maxCycles > 0 && updatedStrategy.cycleCount >= maxCycles) {
        shouldStop = true;
        stopReason = `达到最大周期数 ${maxCycles}`;
      }

      // 止盈/止损检查（基于策略总 PnL 与配置资金的百分比）
      if (!shouldStop && (stopCond.profitTargetPercent || stopCond.maxLossPercent)) {
        const allocCap = riskControl.allocatedCapital || 1000;
        const pnlPercent = allocCap > 0 ? (sTotalPnl / allocCap) * 100 : 0;

        if (stopCond.profitTargetPercent && stopCond.profitTargetPercent > 0 && pnlPercent >= stopCond.profitTargetPercent) {
          shouldStop = true;
          stopReason = `止盈达标: +${pnlPercent.toFixed(1)}% (目标: ${stopCond.profitTargetPercent}%)`;
        } else if (stopCond.maxLossPercent && stopCond.maxLossPercent > 0 && pnlPercent <= -stopCond.maxLossPercent) {
          shouldStop = true;
          stopReason = `止损触发: ${pnlPercent.toFixed(1)}% (限额: -${stopCond.maxLossPercent}%)`;
        }
      }

      if (shouldStop) {
        this.logger.log(`[自动交易] 策略 ${strategyId} ${stopReason}，自动停止`);

        // 平仓 + 结算燃油费（closePosition 内部：平仓后按实际盈利扣费，幂等）
        try {
          await this.aiExecution.closeAllStrategyPositions(userId, strategyId, effectiveExchangeApiKeyId);
        } catch (e: any) {
          this.logger.error(`[自动交易] 停止条件平仓失败(继续停策略): ${e.message}`);
        }

        await db.aiStrategy.update({
          where: { id: strategyId },
          data: { isActive: false },
        });

        // 移除调度任务 + 通知用户
        try { await this.strategyEngine.removeStrategyJob(strategyId); } catch { /* 忽略 */ }
        this.gateway.sendAiStrategyStatus(userId, {
          strategyId,
          status: 'stopped',
          error: stopReason,
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

      // 交易所历史持仓同步 + 统一扣费（唯一入口）
      if (this.closedPnlSyncService && this.adapterFactory) {
        try {
          const syncAdapter = await this.adapterFactory.createAdapter(userId, effectiveExchangeApiKeyId);
          try {
            const syncResult = await this.closedPnlSyncService.syncClosedPositions(
              userId, effectiveExchangeApiKeyId, syncAdapter.exchangeType, syncAdapter,
            );
            if (syncResult.synced > 0 || syncResult.deleted > 0) {
              this.logger.log(`[自动交易] 历史持仓同步: 新增=${syncResult.synced}, 删除=${syncResult.deleted}, 扣费=${syncResult.charged}`);
            }
          } finally {
            try { await syncAdapter.dispose(); } catch { /* 忽略 */ }
          }
        } catch (e: any) {
          this.logger.debug(`[自动交易] 历史持仓同步失败(非致命): ${e.message}`);
        }
      }

      // LOG-8: 周期结束 Banner
      this.logger.log(
        `${'-'.repeat(70)}\n` +
        `✅ 周期完成: 分析=${result.analyzed}, 执行=${result.executed}, 错误=${result.errors}\n` +
        `  耗时=${result.totalLatencyMs}ms, 成本=$${result.totalCost.toFixed(6)}, 策略=${strategyId}\n` +
        `${'='.repeat(70)}`,
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
   * 排序决策（sortDecisionsByPriority）
   * close → open → hold/wait
   */
  private sortDecisions(
    decisions: Array<{
      symbol: string;
      decision: AiTradeDecision;
      passed: boolean;
      cost: number;
      consensusScore: number;
      consensusVotes?: ConsensusVote[];
      rawResponse?: string;
      systemPrompt?: string;
      userPrompt?: string;
      aiThinking?: string;
      marketSnapshot?: any;
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
    strategy: Prisma.AiStrategyGetPayload<{ include: Record<string, never> }>,
    userId: string,
    apiKeyId: string,
    result: CycleResult,
    startTime: number,
    locale = 'zh-CN',
  ): Promise<CycleResult> {
    const gridConfig = strategy.gridConfig as GridConfig | null;
    if (!gridConfig) {
      this.logger.warn(`[网格] 策略 ${strategy.id} 缺少 gridConfig`);
      result.errors = 1;
      return result;
    }
    // 注入 locale 到 gridConfig，供后端日志多语言翻译使用
    gridConfig.locale = locale;
    // 注入止盈目标到 gridConfig，供 AI 提示词使用（来自 stopConditions）
    const gridStopCondForConfig = (strategy.stopConditions as StopConditionsConfig) || {};
    if (gridStopCondForConfig.profitTargetPercent && gridStopCondForConfig.profitTargetPercent > 0) {
      gridConfig.profitTargetPct = gridStopCondForConfig.profitTargetPercent;
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

      // 运行网格循环（传入 gridConfig 以便重启后自动重新初始化）
      const gridResult = await this.gridTrading.runGridCycle(
        strategy.id,
        userId,
        apiKeyId,
        {},
        gridConfig,
      );

      result.analyzed = 1;
      result.executed = gridResult.trades || 0;
      result.errors = gridResult.errors || 0;
      result.totalLatencyMs = Date.now() - startTime;

      // 检查风控是否在本周期中停止了策略（deactivateStrategy 只改 DB，通知由此处统一处理）
      const freshStrategy = await this.prisma.aiStrategy.findUnique({
        where: { id: strategy.id },
        select: { isActive: true, gridRuntimeState: true },
      });
      const gridState = freshStrategy?.gridRuntimeState as { isPaused?: boolean; pauseSource?: string; pauseReason?: string } | null;
      if (freshStrategy && !freshStrategy.isActive && gridState?.isPaused && gridState?.pauseSource === 'risk_control') {
        // 风控触发 → 移除 BullMQ 任务 + WebSocket 通知用户
        try {
          await this.strategyEngine.removeStrategyJob(strategy.id);
        } catch { /* 忽略 */ }

        this.gateway.sendAiStrategyStatus(userId, {
          strategyId: strategy.id,
          status: 'stopped',
          error: gridState.pauseReason || '风控保护已暂停交易',
        });

        this.logger.warn(`[网格] 策略 ${strategy.id} 风控停止，已通知用户`);
        return result;
      }

      // 更新策略统计（Grid 分支：PnL 已由 persistGridState 同步，此处仅更新周期元数据）
      // 网格持仓在 gridRuntimeState JSON 内，不在 position 表中，不能用 position 表计算
      await this.prisma.aiStrategy.update({
        where: { id: strategy.id },
        data: {
          lastCycleAt: new Date(),
          cycleCount: { increment: 1 },
          ...(strategy.consecutiveFailures > 0 ? { consecutiveFailures: 0 } : {}),
        },
      });

      // 网格策略停止条件检查（maxCycles / profitTargetPercent / maxLossPercent）
      const gridStopCond = (strategy.stopConditions as StopConditionsConfig) || {};
      const newCycleCount = (strategy.cycleCount || 0) + 1;
      let gridShouldStop = false;
      let gridStopReason = '';

      if (gridStopCond.maxCycles && gridStopCond.maxCycles > 0 && newCycleCount >= gridStopCond.maxCycles) {
        gridShouldStop = true;
        gridStopReason = `达到最大周期数 ${gridStopCond.maxCycles}`;
      }

      if (!gridShouldStop && (gridStopCond.profitTargetPercent || gridStopCond.maxLossPercent)) {
        const gridStateForStop = await this.gridTrading.getGridState(strategy.id);
        if (gridStateForStop) {
          // 止盈 + 止损统一用权益变化（含浮动盈亏），能及时响应持仓盈亏
          // 修复：旧版止盈用 totalProfit（已实现对冲利润），导致权益+5%但只实现0.55%时不触发
          const investmentBase = (gridConfig?.totalInvestment && gridConfig.totalInvestment > 0)
            ? gridConfig.totalInvestment
            : gridStateForStop.startEquity > 0 ? gridStateForStop.startEquity : 1000;
          const equityPnl = (gridStateForStop.lastEquity > 0 && gridStateForStop.startEquity > 0)
            ? gridStateForStop.lastEquity - gridStateForStop.startEquity
            : gridStateForStop.totalProfit;
          const equityPct = (equityPnl / investmentBase) * 100;
          if (gridStopCond.profitTargetPercent && gridStopCond.profitTargetPercent > 0 && equityPct >= gridStopCond.profitTargetPercent) {
            gridShouldStop = true;
            gridStopReason = `止盈达标: +${equityPct.toFixed(1)}% 权益 (目标: ${gridStopCond.profitTargetPercent}%)`;
          } else if (gridStopCond.maxLossPercent && gridStopCond.maxLossPercent > 0 && equityPct <= -gridStopCond.maxLossPercent) {
            gridShouldStop = true;
            gridStopReason = `止损触发: ${equityPct.toFixed(1)}% (限额: -${gridStopCond.maxLossPercent}%)`;
          }
        }
      }

      if (gridShouldStop) {
        this.logger.log(`[网格] 策略 ${strategy.id} 触发停止条件: ${gridStopReason}`);
        // 平仓 + 结算燃油费（内部调 emergencyExit）
        await this.gridTrading.stopGridForCondition(strategy.id, userId, apiKeyId, gridStopReason);
        // 更新 DB 持仓状态为已平仓 + 推送前端 WebSocket 通知
        try {
          const openPositions = await this.prisma.position.findMany({
            where: { userId, aiStrategyId: strategy.id, status: 'open' },
            select: { id: true, symbol: true, side: true, entryPrice: true, amount: true, markPrice: true },
          });
          for (const pos of openPositions) {
            const exit = Number((pos.markPrice ?? pos.entryPrice).toString());
            const entry = Number(pos.entryPrice.toString());
            const amt = Number(pos.amount.toString());
            const pnl = pos.side === 'long' ? (exit - entry) * amt : (entry - exit) * amt;
            await this.prisma.position.update({
              where: { id: pos.id },
              data: {
                status: 'closed',
                closedAt: new Date(),
                exitPrice: pos.markPrice ?? pos.entryPrice,
                realizedPnl: pnl,
                closeReason: 'grid_stop_condition',
              },
            });
            try {
              this.gateway.sendPositionUpdate(userId, {
                id: pos.id,
                symbol: pos.symbol,
                side: pos.side,
                entryPrice: pos.entryPrice.toString(),
                amount: pos.amount.toString(),
                pnl: pnl.toFixed(4),
                status: 'closed',
                action: 'closed',
              });
            } catch { /* 非致命 */ }
          }
        } catch (e: any) {
          this.logger.warn(`[网格] 停止后 DB 持仓更新失败: ${e.message}`);
        }
        // 停用策略
        await this.prisma.aiStrategy.update({ where: { id: strategy.id }, data: { isActive: false } });
        try { await this.strategyEngine.removeStrategyJob(strategy.id); } catch { /* 忽略 */ }
        this.gateway.sendAiStrategyStatus(userId, {
          strategyId: strategy.id,
          status: 'stopped',
          error: gridStopReason,
        });
        return result;
      }

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
   * 连续失败处理逻辑
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
              reason: `${failures} consecutive cycle failures, auto paused`,
              lastError: translateExchangeError(errorMessage),
            },
            executed: false,
          },
        });

        // WebSocket 通知
        this.gateway.sendAiStrategyStatus(updated.userId, {
          strategyId,
          status: 'error',
          error: `${failures} consecutive failures, strategy auto paused`,
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
  private resolveApiKeys(raw: Record<string, unknown>): UserApiKeys {
    if (!raw || typeof raw !== 'object') return {};
    const result: UserApiKeys = {};
    for (const provider of ['deepseek', 'openai', 'anthropic', 'gemini', 'qwen', 'grok', 'kimi']) {
      const val = raw[provider];
      if (!val) continue;
      const valObj = val as Record<string, unknown>;
      if (typeof val === 'object' && val !== null && valObj.encryptedData && valObj.iv && valObj.authTag) {
        try { result[provider] = decrypt(val as EncryptedData); } catch { /* 解密失败忽略 */ }
      } else if (typeof val === 'string') {
        result[provider] = val;
      }
    }
    return result;
  }
}
