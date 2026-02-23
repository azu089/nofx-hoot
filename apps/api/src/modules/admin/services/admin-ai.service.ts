/**
 * 管理后台 - AI 智能交易管理服务
 * 提供全平台 AI 策略监控、成本统计、用户配置管理、决策日志审计
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';

/** 用户显示名（优先昵称，其次邮箱前缀，最后 userId） */
function displayName(user: { nickname?: string | null; email?: string | null } | null | undefined, fallback: string): string {
  if (!user) return fallback;
  return user.nickname || (user.email ? user.email.split('@')[0] : fallback) || fallback;
}

@Injectable()
export class AdminAiService {
  private readonly logger = new Logger(AdminAiService.name);

  constructor(private prisma: PrismaService) {}

  // ==================== 概览统计 ====================

  /**
   * 获取 AI 总览统计
   * GET /admin/ai/overview
   */
  async getAiOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalStrategies,
      activeStrategies,
      totalResearchSessions,
      todayDecisions,
      todayCostResearch,
      todayCostDebate,
      allAiConfigs,
      strategyAggregates,
    ] = await Promise.all([
      this.prisma.aiStrategy.count(),
      this.prisma.aiStrategy.count({ where: { isActive: true } }),
      this.prisma.aiResearchSession.count(),
      this.prisma.aiStrategyLog.count({
        where: { createdAt: { gte: today } },
      }),
      this.prisma.aiResearchSession.aggregate({
        _sum: { totalCost: true },
        where: { createdAt: { gte: today } },
      }),
      this.prisma.aiDebateSession.aggregate({
        _sum: { totalCost: true },
        where: { createdAt: { gte: today } },
      }),
      // 本月各用户 AI 配置花费（取 top10）
      this.prisma.aiConfig.findMany({
        select: {
          userId: true,
          currentSpend: true,
          user: { select: { nickname: true, email: true } },
        },
        orderBy: { currentSpend: 'desc' },
        take: 10,
      }),
      this.prisma.aiStrategy.aggregate({
        _avg: { winRate: true },
        where: { totalTrades: { gt: 0 } },
      }),
    ]);

    const todayResearch = new Decimal(todayCostResearch._sum.totalCost?.toString() || '0');
    const todayDebate = new Decimal(todayCostDebate._sum.totalCost?.toString() || '0');
    const todayTotalCost = todayResearch.plus(todayDebate);

    const monthTotalCost = allAiConfigs.reduce(
      (sum, c) => sum.plus(new Decimal(c.currentSpend.toString())),
      new Decimal('0'),
    );

    const topCostUsers = allAiConfigs.map((c) => ({
      userId: c.userId,
      username: displayName(c.user, c.userId),
      cost: c.currentSpend.toString(),
    }));

    return {
      totalStrategies,
      activeStrategies,
      totalResearchSessions,
      todayDecisions,
      todayTotalCost: todayTotalCost.toString(),
      monthTotalCost: monthTotalCost.toString(),
      avgWinRate: strategyAggregates._avg.winRate?.toString() || '0',
      topCostUsers,
    };
  }

  // ==================== 策略管理 ====================

  /**
   * 获取全平台策略列表（带分页）
   */
  async getStrategies(query: {
    page?: number;
    limit?: number;
    userId?: string;
    status?: string;
    tradingMode?: string;
    keyword?: string;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.AiStrategyWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.tradingMode) where.tradingMode = query.tradingMode;
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'stopped') where.isActive = false;
    if (query.keyword) {
      where.name = { contains: query.keyword, mode: 'insensitive' };
    }

    const [total, items] = await Promise.all([
      this.prisma.aiStrategy.count({ where }),
      this.prisma.aiStrategy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: { nickname: true, email: true } },
          _count: { select: { logs: true, debateSessions: true } },
        },
      }),
    ]);

    const strategyIds = items.map((s) => s.id);
    const debateCosts = strategyIds.length > 0
      ? await this.prisma.aiDebateSession.groupBy({
          by: ['strategyId'],
          _sum: { totalCost: true },
          where: { strategyId: { in: strategyIds } },
        })
      : [];
    const costMap = new Map(
      debateCosts.map((d) => [d.strategyId, d._sum.totalCost]),
    );

    const data = items.map((s) => ({
      ...s,
      username: displayName(s.user, s.userId),
      totalDebateCost: costMap.get(s.id)?.toString() || '0',
    }));

    return { total, page, limit, data };
  }

  /**
   * 获取策略详情（含最近10条日志）
   */
  async getStrategyDetail(strategyId: string) {
    const strategy = await this.prisma.aiStrategy.findUnique({
      where: { id: strategyId },
      include: {
        user: { select: { id: true, nickname: true, email: true } },
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        debateSessions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            totalCost: true,
            totalLatencyMs: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    return strategy;
  }

  /**
   * 紧急停止策略
   */
  async forceStopStrategy(strategyId: string, reason: string) {
    const strategy = await this.prisma.aiStrategy.findUnique({
      where: { id: strategyId },
    });

    if (!strategy) {
      throw new NotFoundException('策略不存在');
    }

    await this.prisma.aiStrategy.update({
      where: { id: strategyId },
      data: { isActive: false },
    });

    this.logger.warn(`管理员强制停止策略 ${strategyId}，原因：${reason}`);
    return { strategyId, stopped: true };
  }

  // ==================== 研究会话 ====================

  /**
   * 获取全平台研究会话列表
   */
  async getResearchSessions(query: {
    page?: number;
    limit?: number;
    userId?: string;
    status?: string;
    symbol?: string;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.AiResearchSessionWhereInput = { rootSessionId: null };
    if (query.userId) where.userId = query.userId;
    if (query.status) where.status = query.status;
    if (query.symbol) where.symbol = { contains: query.symbol, mode: 'insensitive' };

    const [total, items] = await Promise.all([
      this.prisma.aiResearchSession.count({ where }),
      this.prisma.aiResearchSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          symbol: true,
          depth: true,
          status: true,
          autoExecute: true,
          totalCost: true,
          errorMessage: true,
          cycleNumber: true,
          rootSessionId: true,
          campaignStatus: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { nickname: true, email: true } },
        },
      }),
    ]);

    const data = items.map((s) => ({
      ...s,
      username: displayName(s.user, s.userId),
    }));

    return { total, page, limit, data };
  }

  // ==================== 成本监控 ====================

  /**
   * 获取 Token 成本统计
   */
  async getCostStats(query: {
    period?: 'today' | 'week' | 'month';
    page?: number;
    limit?: number;
    keyword?: string;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const now = new Date();
    let sinceDate: Date;
    switch (query.period) {
      case 'today':
        sinceDate = new Date(now);
        sinceDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      default:
        sinceDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const [researchCosts, debateSessions] = await Promise.all([
      this.prisma.aiResearchSession.groupBy({
        by: ['userId'],
        _sum: { totalCost: true },
        where: { createdAt: { gte: sinceDate } },
      }),
      this.prisma.aiDebateSession.findMany({
        where: { createdAt: { gte: sinceDate } },
        select: { userId: true, totalCost: true },
      }),
    ]);

    const researchMap = new Map(
      researchCosts.map((r) => [r.userId, new Decimal(r._sum.totalCost?.toString() || '0')]),
    );
    const debateMap = new Map<string, Decimal>();
    for (const d of debateSessions) {
      const prev = debateMap.get(d.userId) || new Decimal('0');
      debateMap.set(d.userId, prev.plus(new Decimal(d.totalCost.toString())));
    }

    const allUserIds = new Set([...researchMap.keys(), ...debateMap.keys()]);
    const userIdsArray = Array.from(allUserIds);

    // 搜索时过滤用户
    const userWhere: Prisma.UserWhereInput = { id: { in: userIdsArray } };
    if (query.keyword) {
      userWhere.OR = [
        { nickname: { contains: query.keyword, mode: 'insensitive' } },
        { email: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: { id: true, nickname: true, email: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    let breakdown = userIdsArray
      .filter((uid) => userMap.has(uid))
      .map((uid) => {
        const research = researchMap.get(uid) || new Decimal('0');
        const debate = debateMap.get(uid) || new Decimal('0');
        const total = research.plus(debate);
        const user = userMap.get(uid)!;
        return {
          userId: uid,
          username: displayName(user, uid),
          researchCost: research.toString(),
          strategyCost: debate.toString(),
          total: total.toString(),
          totalNum: total.toNumber(),
        };
      })
      .sort((a, b) => b.totalNum - a.totalNum);

    const paginatedBreakdown = breakdown.slice(skip, skip + limit);

    const totalCost = breakdown.reduce(
      (sum, b) => sum.plus(new Decimal(b.total)),
      new Decimal('0'),
    );

    const dailyTrend = await this.getDailyTrend(30);

    return {
      total: breakdown.length,
      page,
      limit,
      totalCost: totalCost.toString(),
      breakdown: paginatedBreakdown,
      dailyTrend,
    };
  }

  private async getDailyTrend(days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [researchSessions, debateSessions] = await Promise.all([
      this.prisma.aiResearchSession.findMany({
        where: { createdAt: { gte: since } },
        select: { totalCost: true, createdAt: true },
      }),
      this.prisma.aiDebateSession.findMany({
        where: { createdAt: { gte: since } },
        select: { totalCost: true, createdAt: true },
      }),
    ]);

    const dailyMap = new Map<string, Decimal>();
    const addToMap = (cost: { toString(): string } | null | undefined, createdAt: Date) => {
      if (cost == null) return;
      const date = createdAt.toISOString().slice(0, 10);
      const prev = dailyMap.get(date) || new Decimal('0');
      dailyMap.set(date, prev.plus(new Decimal(cost.toString())));
    };

    researchSessions.forEach((s) => addToMap(s.totalCost, s.createdAt));
    debateSessions.forEach((s) => addToMap(s.totalCost, s.createdAt));

    const result: { date: string; cost: string }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const date = d.toISOString().slice(0, 10);
      result.push({ date, cost: (dailyMap.get(date) || new Decimal('0')).toString() });
    }
    return result;
  }

  // ==================== 用户 AI 配置 ====================

  /**
   * 获取用户 AI 配置列表
   */
  async getUserAiConfigs(query: {
    page?: number;
    limit?: number;
    userId?: string;
    isEnabled?: boolean;
    keyword?: string;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.AiConfigWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.isEnabled !== undefined) where.isEnabled = query.isEnabled;
    if (query.keyword) {
      where.user = {
        OR: [
          { nickname: { contains: query.keyword, mode: 'insensitive' } },
          { email: { contains: query.keyword, mode: 'insensitive' } },
        ],
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.aiConfig.count({ where }),
      this.prisma.aiConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: { id: true, nickname: true, email: true } },
        },
      }),
    ]);

    const data = items.map((c) => ({
      ...c,
      username: displayName(c.user, c.userId),
      // 不暴露 apiKeys 明文（仅展示已配置的 provider 名称）
      apiKeys: Object.keys((c.apiKeys as object) || {}).map((k) => `${k}: ***`),
    }));

    return { total, page, limit, data };
  }

  /**
   * 清空用户 LLM API Keys
   */
  async resetUserApiKeys(userId: string) {
    const config = await this.prisma.aiConfig.findUnique({ where: { userId } });
    if (!config) throw new NotFoundException('用户 AI 配置不存在');

    await this.prisma.aiConfig.update({
      where: { userId },
      data: { apiKeys: {} },
    });

    this.logger.warn(`管理员清空用户 ${userId} 的 LLM API Keys`);
    return { userId, reset: true };
  }

  /**
   * 停用用户 AI（同时停止所有活跃策略）
   */
  async disableUserAi(userId: string, reason: string) {
    const config = await this.prisma.aiConfig.findUnique({ where: { userId } });
    if (!config) throw new NotFoundException('用户 AI 配置不存在');

    await this.prisma.aiConfig.update({
      where: { userId },
      data: {
        isEnabled: false,
        autoEnabled: false,
        autoStatus: 'stopped',
        autoStatusReason: `管理员停用: ${reason}`,
      },
    });

    await this.prisma.aiStrategy.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    this.logger.warn(`管理员停用用户 ${userId} 的 AI 功能，原因：${reason}`);
    return { userId, disabled: true };
  }

  // ==================== 决策日志 ====================

  /**
   * 获取 AI 决策日志（安全审计）
   */
  async getDecisionLogs(query: {
    page?: number;
    limit?: number;
    strategyId?: string;
    userId?: string;
    action?: string;
    executed?: boolean;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.AiStrategyLogWhereInput = {};
    if (query.strategyId) where.strategyId = query.strategyId;
    if (query.executed !== undefined) where.executed = query.executed;
    if (query.userId) {
      where.strategy = { userId: query.userId };
    }

    const [total, rawItems] = await Promise.all([
      this.prisma.aiStrategyLog.count({ where }),
      this.prisma.aiStrategyLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // 单独查询关联策略与用户信息
    const strategyIds = [...new Set(rawItems.map((l) => l.strategyId))];
    const strategies =
      strategyIds.length > 0
        ? await this.prisma.aiStrategy.findMany({
            where: { id: { in: strategyIds } },
            select: {
              id: true,
              name: true,
              userId: true,
              user: { select: { nickname: true, email: true } },
            },
          })
        : [];
    const strategyMap = new Map(strategies.map((s) => [s.id, s]));

    const data = rawItems.map((log) => {
      const decision = log.decision as Record<string, unknown> | null;
      const strategy = strategyMap.get(log.strategyId);
      return {
        ...log,
        strategyName: strategy?.name || '',
        username: displayName(strategy?.user, strategy?.userId || ''),
        userId: strategy?.userId || '',
        action: decision?.action || '',
        confidence: decision?.confidence || 0,
      };
    });

    const filtered = query.action
      ? data.filter((d) => d.action === query.action)
      : data;

    return { total, page, limit, data: filtered };
  }
}
