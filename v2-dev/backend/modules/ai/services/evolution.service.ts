import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * AI 交易自进化引擎
 *
 * 功能：
 * 1. 计算滚动 Sharpe Ratio（20 笔交易窗口）
 * 2. 根据 Sharpe 确定行为层级（0=暂停, 1=保守, 2=正常, 3=激进）
 * 3. 生成对应的 AI Prompt 上下文
 * 4. 自动更新用户 AI 配置
 */
@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 计算滚动 Sharpe Ratio
   *
   * @param userId 用户 ID
   * @param windowSize 窗口大小（默认 20 笔交易）
   * @returns Sharpe Ratio 或 null（数据不足）
   */
  async calculateRollingSharpe(
    userId: string,
    windowSize = 20,
  ): Promise<number | null> {
    // 查询最近 N 笔已平仓的 AI 交易
    const positions = await this.prisma.position.findMany({
      where: {
        userId,
        status: 'closed',
        source: 'ai_analysis',
        realizedPnl: { not: null },
        margin: { not: null },
      },
      orderBy: { closedAt: 'desc' },
      take: windowSize,
      select: {
        id: true,
        realizedPnl: true,
        margin: true,
        closedAt: true,
      },
    });

    // 数据不足 5 笔，无法计算有效 Sharpe
    if (positions.length < 5) {
      this.logger.log(
        `用户 ${userId} AI 交易记录不足 (${positions.length} < 5)，无法计算 Sharpe`,
      );
      return null;
    }

    // 计算每笔交易的回报率: r[i] = realizedPnl / margin
    const returns = positions.map((p) => {
      const pnl = Number(p.realizedPnl);
      const margin = Number(p.margin);
      return margin > 0 ? pnl / margin : 0;
    });

    // 计算平均回报率
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // 计算标准差
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      returns.length;
    const stddev = Math.sqrt(variance);

    // 边界情况：标准差为 0 时（所有交易回报相同）
    if (stddev === 0) {
      // 如果平均回报 > 0，返回高分 3.0；否则返回 0
      return mean > 0 ? 3.0 : 0;
    }

    // Sharpe Ratio = (mean / stddev) * sqrt(252)
    // 年化系数：假设每天 1 笔交易，252 个交易日
    const sharpe = (mean / stddev) * Math.sqrt(252);

    this.logger.log(
      `用户 ${userId} 滚动 Sharpe: ${sharpe.toFixed(4)} (窗口: ${positions.length} 笔)`,
    );

    return sharpe;
  }

  /**
   * 根据 Sharpe Ratio 确定行为层级
   *
   * @param sharpe Sharpe Ratio
   * @returns { tier: 0-3, label: string, description: string }
   */
  determineTier(sharpe: number | null): {
    tier: number;
    label: string;
    description: string;
  } {
    if (sharpe === null || sharpe < -0.5) {
      return {
        tier: 0,
        label: '暂停',
        description: '表现不佳，自动暂停交易',
      };
    }

    if (sharpe >= -0.5 && sharpe < 0) {
      return {
        tier: 1,
        label: '保守',
        description: '近期亏损，降低仓位，只做高信心交易',
      };
    }

    if (sharpe >= 0 && sharpe < 0.7) {
      return {
        tier: 2,
        label: '正常',
        description: '表现稳定，正常交易',
      };
    }

    // sharpe >= 0.7
    return {
      tier: 3,
      label: '激进',
      description: '表现优异，允许更大仓位',
    };
  }

  /**
   * 生成进化上下文 Prompt
   *
   * 根据当前层级，生成插入 AI 辩论的上下文说明
   *
   * @param tier 行为层级 0-3
   * @param sharpe Sharpe Ratio
   * @returns Prompt 字符串
   */
  getEvolutionPrompt(tier: number, sharpe: number | null): string {
    const sharpeStr = sharpe !== null ? sharpe.toFixed(4) : 'N/A';

    switch (tier) {
      case 0:
        // 暂停模式：不应该被调用，安全返回空
        return '';

      case 1:
        // 保守模式：只做高信心交易
        return `=== EVOLUTION CONTEXT ===
Recent performance is poor (Sharpe Ratio: ${sharpeStr}). Trade CONSERVATIVELY. Prefer 'hold' or 'wait' unless signals are extremely clear (confidence > 80). Reduce position sizes.`;

      case 2:
        // 正常模式：标准参数
        return `=== EVOLUTION CONTEXT ===
Performance is normal (Sharpe Ratio: ${sharpeStr}). Trade with standard parameters.`;

      case 3:
        // 激进模式：允许适度进取
        return `=== EVOLUTION CONTEXT ===
Recent performance is excellent (Sharpe Ratio: ${sharpeStr}). You may be slightly more aggressive with position sizing and accept moderate-confidence setups (confidence > 55).`;

      default:
        return '';
    }
  }

  /**
   * 更新进化状态
   *
   * 计算 Sharpe → 确定层级 → 更新数据库（如果层级变化）
   *
   * @param userId 用户 ID
   * @returns { tier, sharpe, changed }
   */
  async updateEvolution(
    userId: string,
  ): Promise<{ tier: number; sharpe: number | null; changed: boolean }> {
    // 1. 计算滚动 Sharpe
    const sharpe = await this.calculateRollingSharpe(userId);

    // 2. 确定新层级
    const { tier, label } = this.determineTier(sharpe);

    // 3. 获取当前配置
    const currentConfig = await this.prisma.aiConfig.findUnique({
      where: { userId },
      select: { evolutionTier: true, rollingSharpe: true },
    });

    if (!currentConfig) {
      this.logger.warn(`用户 ${userId} 没有 AI 配置，跳过进化更新`);
      return { tier: 2, sharpe: null, changed: false };
    }

    const currentTier = currentConfig.evolutionTier;

    // 4. 如果层级变化，更新数据库
    let changed = false;
    if (currentTier !== tier) {
      await this.prisma.aiConfig.update({
        where: { userId },
        data: {
          evolutionTier: tier,
          rollingSharpe:
            sharpe !== null ? new Decimal(sharpe.toFixed(4)) : null,
        },
      });

      this.logger.log(
        `用户 ${userId} 进化层级变化: ${currentTier} (${this.determineTier(currentConfig.rollingSharpe ? Number(currentConfig.rollingSharpe) : null).label}) → ${tier} (${label}), Sharpe: ${sharpe?.toFixed(4) ?? 'N/A'}`,
      );
      changed = true;
    } else {
      // 即使层级未变，也更新 Sharpe（保持最新）
      await this.prisma.aiConfig.update({
        where: { userId },
        data: {
          rollingSharpe:
            sharpe !== null ? new Decimal(sharpe.toFixed(4)) : null,
        },
      });
    }

    return { tier, sharpe, changed };
  }

  /**
   * 获取当前进化状态（供前端展示）
   *
   * @param userId 用户 ID
   * @returns 完整的进化状态信息
   */
  async getEvolutionState(userId: string): Promise<{
    tier: number;
    label: string;
    description: string;
    sharpe: number | null;
    totalTrades: number;
    winRate: number;
  }> {
    // 1. 获取 AI 配置
    const config = await this.prisma.aiConfig.findUnique({
      where: { userId },
      select: { evolutionTier: true, rollingSharpe: true },
    });

    const tier = config?.evolutionTier ?? 2;
    const sharpe = config?.rollingSharpe
      ? Number(config.rollingSharpe)
      : null;

    // 2. 获取层级信息
    const { label, description } = this.determineTier(sharpe);

    // 3. 统计交易数据
    const totalTrades = await this.prisma.position.count({
      where: {
        userId,
        status: 'closed',
        source: 'ai_analysis',
      },
    });

    const winningTrades = await this.prisma.position.count({
      where: {
        userId,
        status: 'closed',
        source: 'ai_analysis',
        realizedPnl: { gt: 0 },
      },
    });

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return {
      tier,
      label,
      description,
      sharpe,
      totalTrades,
      winRate,
    };
  }
}
