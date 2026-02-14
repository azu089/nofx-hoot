import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * AI 性能追踪服务 (P7 模块)
 *
 * 功能：
 * - 模型级别性能排名（胜率、盈亏、成本）
 * - 角色准确度分析（各角色判断准确性）
 * - 整体统计概览
 */
@Injectable()
export class AiPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取模型排名
   *
   * 计算每个 AI 模型的表现：
   * - 参与的分析数量
   * - 盈利分析数量
   * - 胜率 = 盈利数 / 总数
   * - 总盈亏、平均盈亏
   * - 总成本
   */
  async getModelRanking(userId: string) {
    // 获取该用户的所有 AI 辩论记录
    const debateEntries = await this.prisma.aiDebateEntry.findMany({
      where: {
        analysis: {
          userId,
        },
      },
      include: {
        analysis: {
          include: {
            signal: {
              include: {
                positions: true,
              },
            },
          },
        },
      },
    });

    // 按模型分组统计
    const modelStats = new Map<string, {
      totalAnalyses: number;
      profitableCount: number;
      totalPnl: number;
      totalCost: number;
      analysisIds: Set<string>;
    }>();

    for (const entry of debateEntries) {
      const model = entry.model;

      if (!modelStats.has(model)) {
        modelStats.set(model, {
          totalAnalyses: 0,
          profitableCount: 0,
          totalPnl: 0,
          totalCost: 0,
          analysisIds: new Set(),
        });
      }

      const stats = modelStats.get(model)!;

      // 每个分析只计数一次（一个模型可能在多轮辩论中出现）
      if (!stats.analysisIds.has(entry.analysisId)) {
        stats.analysisIds.add(entry.analysisId);
        stats.totalAnalyses += 1;

        // 检查该分析是否产生了盈利的持仓
        const positions = entry.analysis.signal?.positions || [];
        const isProfitable = positions.some(pos => {
          const pnl = pos.realizedPnl || pos.pnl;
          return Number(pnl) > 0;
        });

        if (isProfitable) {
          stats.profitableCount += 1;
        }

        // 累计盈亏
        const totalPnl = positions.reduce((sum, pos) => {
          const pnl = pos.realizedPnl || pos.pnl;
          return sum + Number(pnl);
        }, 0);
        stats.totalPnl += totalPnl;
      }

      // 累计成本（每轮都要计入）
      stats.totalCost += Number(entry.cost);
    }

    // 转换为数组并计算派生指标
    const ranking = Array.from(modelStats.entries()).map(([model, stats]) => ({
      model,
      totalAnalyses: stats.totalAnalyses,
      profitableCount: stats.profitableCount,
      winRate: stats.totalAnalyses > 0
        ? (stats.profitableCount / stats.totalAnalyses) * 100
        : 0,
      totalPnl: stats.totalPnl,
      avgPnl: stats.totalAnalyses > 0
        ? stats.totalPnl / stats.totalAnalyses
        : 0,
      totalCost: stats.totalCost,
    }));

    // 按胜率降序排序
    return ranking.sort((a, b) => b.winRate - a.winRate);
  }

  /**
   * 获取角色准确度
   *
   * 计算每个角色（牛派、熊派、分析师、逆向、风控）的判断准确性：
   * - 准确度 = 最终轮次投票方向与实际盈亏方向一致的比例
   * - LONG 投票 + PnL > 0 = 正确
   * - SHORT 投票 + PnL < 0（做空盈利）= 正确
   * - HOLD 投票暂不计入准确度
   */
  async getRoleAccuracy(userId: string) {
    // 获取该用户的所有 AI 辩论记录
    const allEntries = await this.prisma.aiDebateEntry.findMany({
      where: {
        analysis: {
          userId,
        },
      },
      include: {
        analysis: {
          include: {
            signal: {
              include: {
                positions: true,
              },
            },
          },
        },
      },
    });

    // 找出每个 analysisId 的最大轮次，只保留最后一轮的记录
    const maxRoundByAnalysis = new Map<string, number>();
    for (const entry of allEntries) {
      const current = maxRoundByAnalysis.get(entry.analysisId) || 0;
      if (entry.round > current) {
        maxRoundByAnalysis.set(entry.analysisId, entry.round);
      }
    }
    const debateEntries = allEntries.filter(
      e => e.round === maxRoundByAnalysis.get(e.analysisId),
    );

    // 按角色分组统计
    const roleStats = new Map<string, {
      totalVotes: number;
      correctVotes: number;
      totalConfidence: number;
    }>();

    for (const entry of debateEntries) {
      const role = entry.role;

      if (!roleStats.has(role)) {
        roleStats.set(role, {
          totalVotes: 0,
          correctVotes: 0,
          totalConfidence: 0,
        });
      }

      const stats = roleStats.get(role)!;
      stats.totalVotes += 1;
      stats.totalConfidence += Number(entry.confidence);

      // 获取该分析的持仓盈亏
      const positions = entry.analysis.signal?.positions || [];
      if (positions.length === 0) continue; // 没有持仓，无法判断正确性

      // 计算总盈亏
      const totalPnl = positions.reduce((sum, pos) => {
        const pnl = pos.realizedPnl || pos.pnl;
        return sum + Number(pnl);
      }, 0);

      // 判断投票方向是否正确
      const voteDirection = entry.direction; // 'LONG' | 'SHORT' | 'HOLD'
      let isCorrect = false;

      if (voteDirection === 'LONG' && totalPnl > 0) {
        // 看多且盈利
        isCorrect = true;
      } else if (voteDirection === 'SHORT' && totalPnl > 0) {
        // 看空且盈利（做空盈利时 PnL 也是正数）
        isCorrect = true;
      } else if (voteDirection === 'HOLD') {
        // HOLD 投票暂不计入正确性（或可视为"回避"，不统计）
        // 这里可以选择跳过或计入特殊逻辑
        // 当前实现：HOLD 视为中性，不计入 correctVotes
      }

      if (isCorrect) {
        stats.correctVotes += 1;
      }
    }

    // 转换为数组并计算准确率
    const accuracy = Array.from(roleStats.entries()).map(([role, stats]) => ({
      role,
      totalVotes: stats.totalVotes,
      correctVotes: stats.correctVotes,
      accuracy: stats.totalVotes > 0
        ? (stats.correctVotes / stats.totalVotes) * 100
        : 0,
      avgConfidence: stats.totalVotes > 0
        ? stats.totalConfidence / stats.totalVotes
        : 0,
    }));

    // 按准确率降序排序
    return accuracy.sort((a, b) => b.accuracy - a.accuracy);
  }

  /**
   * 获取整体统计
   *
   * 汇总所有 AI 分析的全局指标：
   * - 总分析数、执行数、阻止数、持有数
   * - 总成本
   * - 平均信心度
   * - 方向分布（买入/卖出/持有）
   * - 盈利结果（盈利 vs 亏损）
   */
  async getOverallStats(userId: string) {
    // 获取所有分析记录
    const analyses = await this.prisma.aiAnalysis.findMany({
      where: { userId },
      include: {
        signal: {
          include: {
            positions: true,
          },
        },
        debateEntries: true,
      },
    });

    // 初始化统计
    const stats = {
      totalAnalyses: analyses.length,
      executedCount: 0,
      blockedCount: 0,
      holdCount: 0,
      failedCount: 0,
      totalCost: 0,
      avgConfidence: 0,
      directionBreakdown: {
        buy: 0,
        sell: 0,
        hold: 0,
      },
      outcome: {
        profitable: 0,
        unprofitable: 0,
        breakeven: 0,
      },
    };

    let totalConfidence = 0;

    for (const analysis of analyses) {
      // 状态统计
      if (analysis.status === 'executed') stats.executedCount += 1;
      if (analysis.status === 'blocked') stats.blockedCount += 1;
      if (analysis.status === 'hold') stats.holdCount += 1;
      if (analysis.status === 'failed') stats.failedCount += 1;

      // 成本统计
      stats.totalCost += Number(analysis.executionCost);

      // 信心度统计
      totalConfidence += Number(analysis.confidence);

      // 方向统计
      if (analysis.direction === 'LONG') stats.directionBreakdown.buy += 1;
      if (analysis.direction === 'SHORT') stats.directionBreakdown.sell += 1;
      if (analysis.direction === 'HOLD') stats.directionBreakdown.hold += 1;

      // 盈亏结果统计
      const positions = analysis.signal?.positions || [];
      if (positions.length > 0) {
        const totalPnl = positions.reduce((sum, pos) => {
          const pnl = pos.realizedPnl || pos.pnl;
          return sum + Number(pnl);
        }, 0);

        if (totalPnl > 0) {
          stats.outcome.profitable += 1;
        } else if (totalPnl < 0) {
          stats.outcome.unprofitable += 1;
        } else {
          stats.outcome.breakeven += 1;
        }
      }
    }

    // 计算平均信心度
    stats.avgConfidence = stats.totalAnalyses > 0
      ? totalConfidence / stats.totalAnalyses
      : 0;

    return stats;
  }

  /**
   * 获取性能摘要
   *
   * 组合所有性能指标，返回完整的分析报告
   */
  async getPerformanceSummary(userId: string) {
    const [modelRanking, roleAccuracy, overallStats] = await Promise.all([
      this.getModelRanking(userId),
      this.getRoleAccuracy(userId),
      this.getOverallStats(userId),
    ]);

    return {
      modelRanking,
      roleAccuracy,
      overallStats,
    };
  }
}
