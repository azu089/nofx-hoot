import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ResearchPipelineService, ResearchConfig } from './research-pipeline.service';
import { TradingGateway } from '../../../../gateways/trading.gateway';
import { StrategyEngineService } from '../trading/strategy-engine.service';
import { UserApiKeys } from '../llm.service';
import { ResearchDepth } from '../../types/ai.types';

/**
 * 循环配置 JSON 结构
 */
export interface CyclingConfig {
  enabled: boolean;
  intervalMinutes: number;    // 15, 30, 60, 240
  maxCycles: number;          // 0 = 无限
  profitTargetPercent: number; // 0 = 不限
  maxLossPercent: number;      // 0 = 不限
}

/**
 * 启动循环参数
 */
export interface StartCyclingParams {
  symbol: string;
  depth: ResearchDepth;
  intervalMinutes: number;
  maxCycles: number;
  profitTargetPercent: number;
  maxLossPercent: number;
  exchangeApiKeyId?: string;
  llmApiKeys: UserApiKeys;
  quickModel?: string;
  deepModel?: string;
  riskControlConfig?: Record<string, any>;
  locale?: string;
}

/**
 * 循环统计
 */
export interface CampaignStats {
  rootSessionId: string;
  totalCycles: number;
  currentCycle: number;
  cumulativePnl: number;
  cumulativeCost: number;
  status: string;
  startedAt: string;
  lastCycleAt: string | null;
  childSessions: Array<{
    id: string;
    cycleNumber: number;
    status: string;
    finalDecision: any;
    totalCost: number;
    createdAt: string;
  }>;
}

/**
 * 产品 A 研究自动循环服务
 *
 * 管理研究管线的自动循环执行：
 * 1. 创建根会话 (root session) 作为循环容器
 * 2. 通过 BullMQ repeatable job 按间隔触发周期
 * 3. 每个周期创建子会话，调用 ResearchPipelineService
 * 4. 评估停止条件（最大周期、止盈、最大亏损）
 *
 * 参考 Product B 的 AutoSchedulerService 模式
 */
@Injectable()
export class ResearchCycleService implements OnModuleInit {
  private readonly logger = new Logger(ResearchCycleService.name);

  async onModuleInit(): Promise<void> {
    const restored = await this.restoreRunningCampaigns();
    if (restored > 0) {
      this.logger.log(`[OnModuleInit] 已恢复 ${restored} 个深研循环`);
    }
  }

  constructor(
    @InjectQueue('ai-auto') private readonly autoQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly researchPipeline: ResearchPipelineService,
    private readonly gateway: TradingGateway,
    private readonly strategyEngine: StrategyEngineService,
  ) {}

  /**
   * 启动研究循环
   */
  async startCycling(userId: string, params: StartCyclingParams): Promise<{ rootSessionId: string }> {
    const cyclingConfig: CyclingConfig & { riskControlConfig?: Record<string, any>; locale?: string } = {
      enabled: true,
      intervalMinutes: params.intervalMinutes,
      maxCycles: params.maxCycles || 0,
      profitTargetPercent: params.profitTargetPercent || 0,
      maxLossPercent: params.maxLossPercent || 0,
      // 将风控配置嵌入 cyclingConfig JSON 以便后续周期读取（避免增加新字段/迁移）
      ...(params.riskControlConfig ? { riskControlConfig: params.riskControlConfig } : {}),
      // locale 也嵌入 JSON，确保子周期继承用户语言设置
      ...(params.locale ? { locale: params.locale } : {}),
    };

    // 1. 创建根会话
    const rootSession = await this.prisma.aiResearchSession.create({
      data: {
        userId,
        symbol: params.symbol,
        depth: params.depth,
        autoExecute: true,
        status: 'completed', // 根会话本身不运行管线
        cycleNumber: 0,
        rootSessionId: null,
        cyclingConfig: cyclingConfig as any,
        campaignStatus: 'running',
        exchangeApiKeyId: params.exchangeApiKeyId || null,
        stages: [],
      },
    });

    const rootSessionId = rootSession.id;

    this.logger.log(
      `[循环] 启动: rootSession=${rootSessionId}, symbol=${params.symbol}, ` +
      `interval=${params.intervalMinutes}min, maxCycles=${params.maxCycles}`,
    );

    // 2. 注册 BullMQ repeatable job（最小 3 分钟）
    const intervalMs = Math.max(3, params.intervalMinutes) * 60 * 1000;
    await this.autoQueue.add(
      'research-cycle',
      { rootSessionId, userId },
      {
        repeat: { every: intervalMs },
        jobId: `ai-research-cycle-${rootSessionId}`,
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );

    // 3. 立即触发第一次周期（不等待间隔）
    this.runNextCycle(rootSessionId, params.llmApiKeys, params.quickModel, params.deepModel).catch((err) => {
      this.logger.error(`[循环] 首次周期失败: ${err.message}`);
    });

    // 4. WebSocket 通知
    this.gateway.server?.to(`user:${userId}`).emit('ai:research:cycling-started', {
      rootSessionId,
      symbol: params.symbol,
      intervalMinutes: params.intervalMinutes,
    });

    return { rootSessionId };
  }

  /**
   * 停止循环
   */
  async stopCycling(rootSessionId: string, userId: string): Promise<void> {
    const root = await this.validateRootSession(rootSessionId, userId);

    await this.removeRepeatableJob(rootSessionId);

    await this.prisma.aiResearchSession.update({
      where: { id: rootSessionId },
      data: { campaignStatus: 'stopped' },
    });

    this.logger.log(`[循环] 停止: rootSession=${rootSessionId}`);

    this.gateway.server?.to(`user:${userId}`).emit('ai:research:cycling-stopped', {
      rootSessionId,
      reason: '手动停止',
    });
  }

  /**
   * 暂停循环
   */
  async pauseCycling(rootSessionId: string, userId: string): Promise<void> {
    await this.validateRootSession(rootSessionId, userId);

    await this.removeRepeatableJob(rootSessionId);

    await this.prisma.aiResearchSession.update({
      where: { id: rootSessionId },
      data: { campaignStatus: 'paused' },
    });

    this.logger.log(`[循环] 暂停: rootSession=${rootSessionId}`);

    this.gateway.server?.to(`user:${userId}`).emit('ai:research:cycling-paused', {
      rootSessionId,
    });
  }

  /**
   * 恢复循环
   */
  async resumeCycling(rootSessionId: string, userId: string): Promise<void> {
    const root = await this.validateRootSession(rootSessionId, userId);

    if (root.campaignStatus !== 'paused' && root.campaignStatus !== 'stopped') {
      throw new Error('只能恢复暂停或已停止状态的循环');
    }

    const config = root.cyclingConfig as unknown as CyclingConfig;
    const intervalMs = config.intervalMinutes * 60 * 1000;

    // 重新注册 BullMQ job
    await this.autoQueue.add(
      'research-cycle',
      { rootSessionId, userId },
      {
        repeat: { every: intervalMs },
        jobId: `ai-research-cycle-${rootSessionId}`,
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );

    await this.prisma.aiResearchSession.update({
      where: { id: rootSessionId },
      data: { campaignStatus: 'running' },
    });

    this.logger.log(`[循环] 恢复: rootSession=${rootSessionId}`);

    this.gateway.server?.to(`user:${userId}`).emit('ai:research:cycling-resumed', {
      rootSessionId,
    });
  }

  /**
   * 执行下一个周期（由 BullMQ processor 或首次启动调用）
   */
  async runNextCycle(
    rootSessionId: string,
    llmApiKeys?: UserApiKeys,
    quickModel?: string,
    deepModel?: string,
  ): Promise<void> {
    // 1. 查询根会话
    const root = await this.prisma.aiResearchSession.findUnique({
      where: { id: rootSessionId },
    });

    if (!root || root.campaignStatus !== 'running') {
      this.logger.debug(`[循环] 跳过: rootSession=${rootSessionId}, status=${root?.campaignStatus}`);
      return;
    }

    // 2. 评估停止条件
    const stopCheck = await this.evaluateStopConditions(rootSessionId);
    if (stopCheck.shouldStop) {
      this.logger.log(`[循环] 停止条件满足: ${stopCheck.reason}`);

      await this.removeRepeatableJob(rootSessionId);
      await this.prisma.aiResearchSession.update({
        where: { id: rootSessionId },
        data: { campaignStatus: 'completed' },
      });

      this.gateway.server?.to(`user:${root.userId}`).emit('ai:research:cycling-completed', {
        rootSessionId,
        reason: stopCheck.reason,
      });
      return;
    }

    // 3. 计算周期号
    const childCount = await this.prisma.aiResearchSession.count({
      where: { rootSessionId },
    });
    const cycleNumber = childCount + 1;

    this.logger.log(`[循环] 周期 #${cycleNumber} 开始: rootSession=${rootSessionId}`);

    // 4. 获取 LLM Keys（首次直接传入，后续需从 AiConfig 获取）
    let apiKeys = llmApiKeys;
    if (!apiKeys) {
      const aiConfig = await this.prisma.aiConfig.findUnique({
        where: { userId: root.userId },
      });
      apiKeys = (aiConfig?.apiKeys as unknown as UserApiKeys) || {};
    }

    // 5. 创建子会话
    const childSession = await this.prisma.aiResearchSession.create({
      data: {
        userId: root.userId,
        symbol: root.symbol,
        depth: root.depth,
        autoExecute: true,
        status: 'running',
        cycleNumber,
        rootSessionId,
        exchangeApiKeyId: root.exchangeApiKeyId,
        stages: [],
      },
    });

    // G1: 周期性持仓同步 — 对齐 Solo/Debate 的 R2 步骤
    // 架构原则：捕获交易所实时持仓，传递给 runResearch，避免 DB 快照延迟
    let liveExchangePositions: any[] = [];
    if (root.exchangeApiKeyId) {
      try {
        const syncResult = await this.strategyEngine.syncPositionsForUser(
          root.userId,
          root.exchangeApiKeyId,
        );
        liveExchangePositions = syncResult.exchangePositions;
        if (syncResult.created > 0 || syncResult.closed > 0) {
          this.logger.log(
            `[循环-R2] 持仓同步: 新建${syncResult.created}, 关闭${syncResult.closed}, 交易所持仓=${liveExchangePositions.length}`,
          );
        }
      } catch (e: any) {
        this.logger.warn(`[循环-R2] 持仓同步失败(非致命): ${e.message}`);
      }
    }

    // 6. 运行研究管线
    const cycConfig = root.cyclingConfig as any;
    const config: ResearchConfig = {
      userId: root.userId,
      symbol: root.symbol,
      depth: root.depth as ResearchDepth,
      autoExecute: true,
      apiKeyId: root.exchangeApiKeyId || undefined,
      llmApiKeys: apiKeys,
      quickThinkModel: quickModel,
      deepThinkModel: deepModel,
      sessionId: childSession.id,
      // 从根会话的 cyclingConfig JSON 中还原风控参数
      riskControlConfig: cycConfig?.riskControlConfig || undefined,
      // 从根会话的 cyclingConfig JSON 中还原语言设置
      locale: cycConfig?.locale || 'zh-CN',
      // 交易所实时持仓（避免 Trader 阶段再查 DB）
      exchangePositions: liveExchangePositions,
    };

    try {
      await this.researchPipeline.runResearch(config);
    } catch (error) {
      this.logger.error(`[循环] 周期 #${cycleNumber} 管线失败: ${error.message}`);
    }

    // 7. WebSocket 通知周期完成
    this.gateway.server?.to(`user:${root.userId}`).emit('ai:research:cycle-complete', {
      rootSessionId,
      cycleNumber,
      childSessionId: childSession.id,
    });
  }

  /**
   * 获取循环统计
   */
  async getCampaignStats(rootSessionId: string, userId: string): Promise<CampaignStats> {
    const root = await this.prisma.aiResearchSession.findFirst({
      where: { id: rootSessionId, userId },
    });

    if (!root) {
      throw new Error('循环会话不存在');
    }

    const childSessions = await this.prisma.aiResearchSession.findMany({
      where: { rootSessionId },
      orderBy: { cycleNumber: 'asc' },
      select: {
        id: true,
        cycleNumber: true,
        status: true,
        finalDecision: true,
        executedTradeId: true,
        totalCost: true,
        createdAt: true,
      },
    });

    // 累计 LLM 成本
    const cumulativeCost = childSessions.reduce(
      (sum, s) => sum + Number(s.totalCost),
      0,
    );

    // 累计 PnL — 查询所有 ai_research 来源的已关闭仓位
    // 通过 executedTradeId 关联的 position
    const childIds = childSessions.map((s) => s.id);
    const sessionsWithTrades = await this.prisma.aiResearchSession.findMany({
      where: { id: { in: childIds }, executedTradeId: { not: null } },
      select: { executedTradeId: true },
    });

    let cumulativePnl = 0;
    if (sessionsWithTrades.length > 0) {
      const tradeIds = sessionsWithTrades
        .map((s) => s.executedTradeId)
        .filter(Boolean) as string[];
      if (tradeIds.length > 0) {
        const positions = await this.prisma.position.findMany({
          where: { id: { in: tradeIds }, status: 'closed' },
          select: { realizedPnl: true },
        });
        cumulativePnl = positions.reduce(
          (sum, p) => sum + Number(p.realizedPnl),
          0,
        );
      }
    }

    // 查询每个子会话的持仓 PnL
    const childTradeIds = childSessions
      .map((s) => s.executedTradeId)
      .filter((id): id is string => !!id && id !== 'executed');

    const childPositions = childTradeIds.length > 0
      ? await this.prisma.position.findMany({
          where: { id: { in: childTradeIds } },
          select: { id: true, status: true, realizedPnl: true, unrealizedPnl: true },
        })
      : [];
    const posMap = new Map(childPositions.map((p) => [p.id, p]));

    const lastChild = childSessions.length > 0
      ? childSessions[childSessions.length - 1]
      : null;

    return {
      rootSessionId,
      totalCycles: childSessions.length,
      currentCycle: childSessions.length,
      cumulativePnl,
      cumulativeCost,
      status: root.campaignStatus || 'unknown',
      startedAt: root.createdAt.toISOString(),
      lastCycleAt: lastChild ? lastChild.createdAt.toISOString() : null,
      childSessions: childSessions.map((s) => {
        const pos = s.executedTradeId ? posMap.get(s.executedTradeId) : null;
        return {
          id: s.id,
          cycleNumber: s.cycleNumber,
          status: s.status,
          finalDecision: s.finalDecision,
          executedTradeId: s.executedTradeId,
          totalCost: Number(s.totalCost),
          pnl: pos ? Number(pos.status === 'closed' ? pos.realizedPnl : pos.unrealizedPnl) : null,
          positionStatus: pos?.status || null,
          createdAt: s.createdAt.toISOString(),
        };
      }),
    };
  }

  /**
   * 服务启动时恢复运行中的循环
   */
  async restoreRunningCampaigns(): Promise<number> {
    try {
      const runningCampaigns = await this.prisma.aiResearchSession.findMany({
        where: {
          campaignStatus: 'running',
          rootSessionId: null, // 只查根会话
          cyclingConfig: { not: Prisma.DbNull },
        },
      });

      let restored = 0;

      for (const root of runningCampaigns) {
        try {
          const config = root.cyclingConfig as unknown as CyclingConfig;
          if (!config?.enabled) continue;

          const intervalMs = config.intervalMinutes * 60 * 1000;

          // 先清理旧 job
          await this.removeRepeatableJob(root.id).catch(() => {});

          // 重新注册
          await this.autoQueue.add(
            'research-cycle',
            { rootSessionId: root.id, userId: root.userId },
            {
              repeat: { every: intervalMs },
              jobId: `ai-research-cycle-${root.id}`,
              removeOnComplete: 50,
              removeOnFail: 20,
            },
          );

          restored++;
          this.logger.log(`[循环] 恢复: rootSession=${root.id}`);
        } catch (error) {
          this.logger.error(`[循环] 恢复失败: rootSession=${root.id} - ${error.message}`);
        }
      }

      if (restored > 0) {
        this.logger.log(`[循环] 恢复完成: 共 ${restored} 个研究循环`);
      }

      return restored;
    } catch (error) {
      this.logger.error(`[循环] 恢复失败: ${error.message}`);
      return 0;
    }
  }

  // ─── 私有辅助方法 ──────────────────────────────────────────────

  /**
   * 评估停止条件
   */
  private async evaluateStopConditions(rootSessionId: string): Promise<{
    shouldStop: boolean;
    reason?: string;
  }> {
    const root = await this.prisma.aiResearchSession.findUnique({
      where: { id: rootSessionId },
    });

    if (!root?.cyclingConfig) {
      return { shouldStop: false };
    }

    const config = root.cyclingConfig as unknown as CyclingConfig;

    // 1. 最大周期数
    const childCount = await this.prisma.aiResearchSession.count({
      where: { rootSessionId },
    });

    if (config.maxCycles > 0 && childCount >= config.maxCycles) {
      return {
        shouldStop: true,
        reason: `已达最大周期数 ${config.maxCycles}`,
      };
    }

    // 2. 止盈/止损检查（基于已关闭仓位的累计 PnL）
    if (config.profitTargetPercent > 0 || config.maxLossPercent > 0) {
      // 获取用户 AiConfig 中的 amountPerTrade 作为基准
      const aiConfig = await this.prisma.aiConfig.findUnique({
        where: { userId: root.userId },
        select: { amountPerTrade: true },
      });
      const baseAmount = Number(aiConfig?.amountPerTrade || 100);

      // 查询所有 ai_research 来源的已关闭仓位
      const positions = await this.prisma.position.findMany({
        where: {
          userId: root.userId,
          source: 'ai_research',
          status: 'closed',
          createdAt: { gte: root.createdAt },
        },
        select: { realizedPnl: true },
      });

      const totalPnl = positions.reduce(
        (sum, p) => sum + Number(p.realizedPnl),
        0,
      );
      const pnlPercent = (totalPnl / baseAmount) * 100;

      // 止盈
      if (config.profitTargetPercent > 0 && pnlPercent >= config.profitTargetPercent) {
        return {
          shouldStop: true,
          reason: `止盈达标: +${pnlPercent.toFixed(1)}% (目标: ${config.profitTargetPercent}%)`,
        };
      }

      // 止损
      if (config.maxLossPercent > 0 && pnlPercent <= -config.maxLossPercent) {
        return {
          shouldStop: true,
          reason: `止损触发: ${pnlPercent.toFixed(1)}% (限额: -${config.maxLossPercent}%)`,
        };
      }
    }

    return { shouldStop: false };
  }

  /**
   * 验证根会话归属
   */
  private async validateRootSession(rootSessionId: string, userId: string) {
    const root = await this.prisma.aiResearchSession.findFirst({
      where: { id: rootSessionId, userId, rootSessionId: null },
    });

    if (!root) {
      throw new Error('循环会话不存在或无权访问');
    }

    return root;
  }

  /**
   * 移除 BullMQ repeatable job
   */
  private async removeRepeatableJob(rootSessionId: string): Promise<void> {
    try {
      const repeatableJobs = await this.autoQueue.getRepeatableJobs();

      for (const job of repeatableJobs) {
        if (job.id === `ai-research-cycle-${rootSessionId}` || job.key.includes(rootSessionId)) {
          await this.autoQueue.removeRepeatableByKey(job.key);
          this.logger.debug(`[循环] 移除 job: ${job.key}`);
        }
      }
    } catch (error) {
      this.logger.error(`[循环] 移除 job 失败: ${error.message}`);
    }
  }
}
