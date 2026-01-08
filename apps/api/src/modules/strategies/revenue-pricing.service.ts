import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Decimal from 'decimal.js';

/**
 * 收益分成定价服务 - Phase 16 完整版
 *
 * 核心功能：
 * 1. 根据策略表现动态计算分成等级（Bronze → Diamond 5 个等级）
 * 2. 更新策略的分成比例
 * 3. 提供升级进度查询
 *
 * 分成等级规则（Phase 16 完整版）：
 * - Bronze（青铜）: 10% - 默认等级
 * - Silver（白银）: 20% - 需要 10+ 用户 且 累计盈利 1000+ USDT 且 胜率 ≥ 50%
 * - Gold（黄金）: 30% - 需要 50+ 用户 且 累计盈利 10000+ USDT 且 胜率 ≥ 60%
 * - Platinum（铂金）: 40% - 需要 200+ 用户 且 累计盈利 50000+ USDT 且 胜率 ≥ 65% 且 夏普比率 ≥ 1.5
 * - Diamond（钻石）: 50% - 需要 500+ 用户 且 累计盈利 200000+ USDT 且 胜率 ≥ 70% 且 夏普比率 ≥ 2.0
 */

interface TierConfig {
  level: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  minUsers: number;
  minProfit: number;
  minWinRate: number;
  minSharpeRatio?: number; // 可选，仅 Platinum 和 Diamond 需要
  rate: Decimal;
}

interface TierResult {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  rate: Decimal;
  nextTier?: {
    level: string;
    requiredUsers: number;
    requiredProfit: number;
    requiredWinRate: number;
    requiredSharpeRatio?: number;
  };
}

@Injectable()
export class RevenuePricingService {
  private readonly logger = new Logger(RevenuePricingService.name);

  // 分成等级配置（Phase 16 完整版：5 个等级）
  private readonly tierConfigs: TierConfig[] = [
    {
      level: 'bronze',
      minUsers: 0,
      minProfit: 0,
      minWinRate: 0,
      rate: new Decimal('0.1000'), // 10%
    },
    {
      level: 'silver',
      minUsers: 10,
      minProfit: 1000,
      minWinRate: 50, // 50%
      rate: new Decimal('0.2000'), // 20%
    },
    {
      level: 'gold',
      minUsers: 50,
      minProfit: 10000,
      minWinRate: 60, // 60%
      rate: new Decimal('0.3000'), // 30%
    },
    {
      level: 'platinum',
      minUsers: 200,
      minProfit: 50000,
      minWinRate: 65, // 65%
      minSharpeRatio: 1.5, // 夏普比率 ≥ 1.5
      rate: new Decimal('0.4000'), // 40%
    },
    {
      level: 'diamond',
      minUsers: 500,
      minProfit: 200000,
      minWinRate: 70, // 70%
      minSharpeRatio: 2.0, // 夏普比率 ≥ 2.0
      rate: new Decimal('0.5000'), // 50%
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 计算策略的分成等级
   * @param strategyId 策略 ID
   * @returns 等级信息和分成比例
   */
  async calculateStrategyTier(strategyId: string): Promise<TierResult> {
    this.logger.log(`计算策略分成等级: ${strategyId}`);

    // 获取策略性能数据（Phase 16 完整版：添加夏普比率）
    const strategy = await this.prisma.client.strategies.findUnique({
      where: { id: strategyId },
      select: {
        total_users: true,
        total_profit: true,
        avg_win_rate: true,
        avg_sharpe_ratio: true, // Phase 16: 新增夏普比率
      },
    });

    if (!strategy) {
      throw new Error(`策略不存在: ${strategyId}`);
    }

    const totalUsers = strategy.total_users || 0;
    const totalProfit = new Decimal(strategy.total_profit || 0);
    const avgWinRate = strategy.avg_win_rate
      ? new Decimal(strategy.avg_win_rate)
      : new Decimal(0);
    const avgSharpeRatio = strategy.avg_sharpe_ratio
      ? new Decimal(strategy.avg_sharpe_ratio)
      : new Decimal(0);

    this.logger.debug(
      `策略性能: 用户数=${totalUsers}, 累计盈利=${totalProfit}, 胜率=${avgWinRate}%, 夏普=${avgSharpeRatio}`,
    );

    // 从高到低匹配分级（Diamond -> Platinum -> Gold -> Silver -> Bronze）
    for (let i = this.tierConfigs.length - 1; i >= 0; i--) {
      const tier = this.tierConfigs[i];

      // Phase 16 完整版：支持夏普比率检查
      const sharpeCheck =
        !tier.minSharpeRatio || avgSharpeRatio.gte(tier.minSharpeRatio);

      if (
        totalUsers >= tier.minUsers &&
        totalProfit.gte(tier.minProfit) &&
        avgWinRate.gte(tier.minWinRate) &&
        sharpeCheck
      ) {
        // 找到匹配的等级
        const nextTierConfig =
          i < this.tierConfigs.length - 1
            ? this.tierConfigs[i + 1]
            : undefined;

        const result: TierResult = {
          tier: tier.level,
          rate: tier.rate,
        };

        // 计算距离下一等级的差距（Phase 16: 支持夏普比率）
        if (nextTierConfig) {
          result.nextTier = {
            level: nextTierConfig.level,
            requiredUsers: Math.max(0, nextTierConfig.minUsers - totalUsers),
            requiredProfit: Math.max(
              0,
              nextTierConfig.minProfit - totalProfit.toNumber(),
            ),
            requiredWinRate: Math.max(
              0,
              nextTierConfig.minWinRate - avgWinRate.toNumber(),
            ),
          };

          // Phase 16: 如果下一等级需要夏普比率，添加该字段
          if (nextTierConfig.minSharpeRatio) {
            result.nextTier.requiredSharpeRatio = Math.max(
              0,
              nextTierConfig.minSharpeRatio - avgSharpeRatio.toNumber(),
            );
          }
        }

        this.logger.log(
          `策略 ${strategyId} 等级: ${tier.level.toUpperCase()} (${tier.rate.times(100)}%)`,
        );

        return result;
      }
    }

    // 默认青铜级（不应该走到这里，因为 bronze 的门槛是 0）
    return {
      tier: 'bronze',
      rate: this.tierConfigs[0].rate,
      nextTier: this.tierConfigs[1]
        ? {
            level: this.tierConfigs[1].level,
            requiredUsers: this.tierConfigs[1].minUsers,
            requiredProfit: this.tierConfigs[1].minProfit,
            requiredWinRate: this.tierConfigs[1].minWinRate,
          }
        : undefined,
    };
  }

  /**
   * 更新策略的分成等级和比例
   * @param strategyId 策略 ID
   */
  async updateStrategyRevenueTier(strategyId: string): Promise<void> {
    this.logger.log(`更新策略分成等级: ${strategyId}`);

    const { tier, rate } = await this.calculateStrategyTier(strategyId);

    // 更新数据库
    await this.prisma.client.strategies.update({
      where: { id: strategyId },
      data: {
        tier: tier,
        revenue_share_rate: rate.toString(),
        last_performance_calc: new Date(),
      },
    });

    this.logger.log(
      `策略 ${strategyId} 分成等级已更新: ${tier.toUpperCase()} (${rate.times(100)}%)`,
    );
  }

  /**
   * 批量更新所有用户策略的分成等级
   * 用于定时任务（每日凌晨执行）
   */
  async updateAllUserStrategiesTiers(): Promise<{
    total: number;
    upgraded: number;
    downgraded: number;
    unchanged: number;
  }> {
    this.logger.log('开始批量更新用户策略分成等级...');

    // 获取所有用户上传的策略
    const userStrategies = await this.prisma.client.strategies.findMany({
      where: {
        owner_type: 'user',
        is_active: true,
        revenue_share_enabled: true,
      },
      select: {
        id: true,
        name: true,
        tier: true,
      },
    });

    let upgraded = 0;
    let downgraded = 0;
    let unchanged = 0;

    for (const strategy of userStrategies) {
      const oldTier = strategy.tier || 'bronze';
      const { tier: newTier } = await this.calculateStrategyTier(strategy.id);

      // 更新等级
      await this.updateStrategyRevenueTier(strategy.id);

      // 统计变化
      if (newTier > oldTier) {
        upgraded++;
        this.logger.log(
          `策略 "${strategy.name}" 升级: ${oldTier} -> ${newTier}`,
        );
      } else if (newTier < oldTier) {
        downgraded++;
        this.logger.log(
          `策略 "${strategy.name}" 降级: ${oldTier} -> ${newTier}`,
        );
      } else {
        unchanged++;
      }
    }

    this.logger.log(
      `批量更新完成: 总数=${userStrategies.length}, 升级=${upgraded}, 降级=${downgraded}, 不变=${unchanged}`,
    );

    return {
      total: userStrategies.length,
      upgraded,
      downgraded,
      unchanged,
    };
  }

  /**
   * 获取策略升级进度
   * @param strategyId 策略 ID
   * @returns 当前等级和升级进度
   */
  async getUpgradeProgress(strategyId: string): Promise<{
    currentTier: string;
    currentRate: string;
    nextTier?: {
      level: string;
      requiredUsers: number;
      requiredProfit: number;
      requiredWinRate: number;
      progressUsers: number; // 百分比 0-100
      progressProfit: number; // 百分比 0-100
      progressWinRate: number; // 百分比 0-100
    };
  }> {
    const { tier, rate, nextTier } =
      await this.calculateStrategyTier(strategyId);

    const result = {
      currentTier: tier,
      currentRate: rate.toString(),
      nextTier: undefined as any,
    };

    if (nextTier) {
      // 获取当前策略数据
      const strategy = await this.prisma.client.strategies.findUnique({
        where: { id: strategyId },
        select: {
          total_users: true,
          total_profit: true,
          avg_win_rate: true,
        },
      });

      const totalUsers = strategy?.total_users || 0;
      const totalProfit = new Decimal(strategy?.total_profit || 0);
      const avgWinRate = strategy?.avg_win_rate
        ? new Decimal(strategy.avg_win_rate)
        : new Decimal(0);

      // 计算进度百分比
      const progressUsers =
        nextTier.requiredUsers > 0
          ? Math.min(
              100,
              Math.round((totalUsers / nextTier.requiredUsers) * 100),
            )
          : 100;

      const progressProfit =
        nextTier.requiredProfit > 0
          ? Math.min(
              100,
              Math.round(
                (totalProfit.toNumber() / nextTier.requiredProfit) * 100,
              ),
            )
          : 100;

      const progressWinRate =
        nextTier.requiredWinRate > 0
          ? Math.min(
              100,
              Math.round(
                (avgWinRate.toNumber() / nextTier.requiredWinRate) * 100,
              ),
            )
          : 100;

      result.nextTier = {
        level: nextTier.level,
        requiredUsers: nextTier.requiredUsers,
        requiredProfit: nextTier.requiredProfit,
        requiredWinRate: nextTier.requiredWinRate,
        progressUsers,
        progressProfit,
        progressWinRate,
      };
    }

    return result;
  }

  /**
   * 获取等级配置信息（用于前端展示）
   */
  getTierConfigs(): Array<{
    level: string;
    minUsers: number;
    minProfit: number;
    minWinRate: number;
    rate: string;
  }> {
    return this.tierConfigs.map((config) => ({
      level: config.level,
      minUsers: config.minUsers,
      minProfit: config.minProfit,
      minWinRate: config.minWinRate,
      rate: config.rate.toString(),
    }));
  }
}
