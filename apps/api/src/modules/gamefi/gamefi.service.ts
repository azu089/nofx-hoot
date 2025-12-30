import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { StakingService } from '../staking/staking.service';
import { TokensService } from '../tokens/tokens.service';
import {
  GamefiOverviewDto,
  LeaderboardResponseDto,
  LeaderboardEntryDto,
} from './dto/overview-response.dto';
import Decimal from 'decimal.js';

/**
 * GameFi 统一服务
 * 整合积分、质押、代币功能，提供概览和排行榜
 */
@Injectable()
export class GamefiService {
  private readonly logger = new Logger(GamefiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
    private readonly stakingService: StakingService,
    private readonly tokensService: TokensService,
  ) {}

  /**
   * 获取 GameFi 概览数据
   * @param userId 用户 ID
   * @returns GameFi 概览
   */
  async getOverview(userId: string): Promise<GamefiOverviewDto> {
    // 并行获取各模块数据
    const [pointsBalance, stakesData, tokenBalance, vestingProgress, todayPointsEarned] =
      await Promise.all([
        this.pointsService.getBalance(userId),
        this.stakingService.getStakes(userId),
        this.tokensService.getBalance(userId),
        this.tokensService.getVestingProgress(userId),
        this.getTodayPointsEarned(userId),
      ]);

    // 获取收益统计
    const rewardStats = await this.stakingService.getRewardStats(userId);

    return {
      points: {
        available: pointsBalance.available,
        frozen: pointsBalance.frozen,
        total: pointsBalance.total,
        todayEarned: todayPointsEarned,
      },
      staking: {
        totalStaked: stakesData.total_staked,
        totalReward: stakesData.total_reward,
        activeCount: stakesData.stakes.filter((s) => s.status === 'active').length,
        averageWeight: rewardStats.average_weight,
      },
      tokens: {
        available: tokenBalance.available,
        locked: tokenBalance.locked,
        vesting: tokenBalance.vesting,
        total: tokenBalance.total,
      },
      rewards: {
        claimable: rewardStats.claimable,
        claimed: rewardStats.claimed,
        nextReleaseAmount: vestingProgress.nextReleaseAmount,
        nextReleaseDate: vestingProgress.nextReleaseDate,
      },
    };
  }

  /**
   * 获取今日积分获取量
   * @param userId 用户 ID
   * @returns 今日获取的积分数量
   */
  private async getTodayPointsEarned(userId: string): Promise<string> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = await this.prisma.client.billing_logs.findMany({
      where: {
        user_id: userId,
        currency: 'POINTS',
        billing_type: 'points_earn',
        created_at: {
          gte: today,
        },
      },
    });

    const total = logs.reduce(
      (sum, log) => sum.plus(new Decimal(log.amount)),
      new Decimal(0),
    );

    return total.toString();
  }

  /**
   * 获取积分排行榜
   * @param userId 当前用户 ID（用于获取自己的排名）
   * @param period 时间范围（day/week/month/all）
   * @param limit 限制条数
   * @param offset 偏移量
   * @returns 排行榜数据
   */
  async getLeaderboard(
    userId: string,
    period: 'day' | 'week' | 'month' | 'all' = 'all',
    limit: number = 100,
    offset: number = 0,
  ): Promise<LeaderboardResponseDto> {
    // 计算时间范围
    let startDate: Date | null = null;
    const now = new Date();

    if (period === 'day') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setHours(0, 0, 0, 0);
    }

    // 根据时间范围查询积分
    let entries: LeaderboardEntryDto[];
    let total: number;

    if (period === 'all') {
      // 全部时间：直接从钱包查询积分余额排行
      const wallets = await this.prisma.client.wallets.findMany({
        select: {
          user_id: true,
          points_balance: true,
        },
        orderBy: {
          points_balance: 'desc',
        },
        take: limit,
        skip: offset,
      });

      // 获取用户信息
      const userIds = wallets.map((w) => w.user_id);
      const users = await this.prisma.client.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, vip_level: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      entries = wallets.map((wallet, index) => {
        const user = userMap.get(wallet.user_id);
        return {
          rank: offset + index + 1,
          userId: wallet.user_id,
          email: user ? this.maskEmail(user.email) : '***',
          totalPoints: wallet.points_balance.toString(),
          todayPoints: '0', // 全部时间模式不显示今日积分
          vipLevel: user?.vip_level || 0,
        };
      });

      total = await this.prisma.client.wallets.count();
    } else {
      // 时间范围内：从 billing_logs 聚合积分
      const pointsData = await this.prisma.client.$queryRaw<
        { user_id: string; total_points: string }[]
      >`
        SELECT
          user_id,
          SUM(CAST(amount AS DECIMAL(18,8))) as total_points
        FROM billing_logs
        WHERE
          currency = 'POINTS'
          AND billing_type = 'points_earn'
          AND created_at >= ${startDate}
        GROUP BY user_id
        ORDER BY total_points DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      // 获取用户信息
      const userIds = pointsData.map((p) => p.user_id);
      const users = await this.prisma.client.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, vip_level: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      // 获取用户总积分
      const wallets = await this.prisma.client.wallets.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true, points_balance: true },
      });
      const walletMap = new Map(wallets.map((w) => [w.user_id, w]));

      entries = pointsData.map((data, index) => {
        const user = userMap.get(data.user_id);
        const wallet = walletMap.get(data.user_id);
        return {
          rank: offset + index + 1,
          userId: data.user_id,
          email: user ? this.maskEmail(user.email) : '***',
          totalPoints: wallet?.points_balance.toString() || '0',
          todayPoints: data.total_points,
          vipLevel: user?.vip_level || 0,
        };
      });

      // 统计总数
      const countResult = await this.prisma.client.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT user_id) as count
        FROM billing_logs
        WHERE
          currency = 'POINTS'
          AND billing_type = 'points_earn'
          AND created_at >= ${startDate}
      `;
      total = Number(countResult[0]?.count || 0);
    }

    // 获取当前用户的排名
    const myRankData = await this.getMyRank(userId, period, startDate);

    return {
      entries,
      total,
      myRank: myRankData.rank,
      myPoints: myRankData.points,
      period,
    };
  }

  /**
   * 获取当前用户的排名
   */
  private async getMyRank(
    userId: string,
    period: 'day' | 'week' | 'month' | 'all',
    startDate: Date | null,
  ): Promise<{ rank: number | null; points: string }> {
    // 获取用户钱包
    const wallet = await this.prisma.client.wallets.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      return { rank: null, points: '0' };
    }

    if (period === 'all') {
      // 全部时间：统计比当前用户积分高的人数
      const higherCount = await this.prisma.client.wallets.count({
        where: {
          points_balance: {
            gt: wallet.points_balance,
          },
        },
      });

      return {
        rank: higherCount + 1,
        points: wallet.points_balance.toString(),
      };
    } else {
      // 时间范围内：统计用户在该时间段内的积分
      const userPointsResult = await this.prisma.client.$queryRaw<
        { total_points: string }[]
      >`
        SELECT
          COALESCE(SUM(CAST(amount AS DECIMAL(18,8))), 0) as total_points
        FROM billing_logs
        WHERE
          user_id = ${userId}
          AND currency = 'POINTS'
          AND billing_type = 'points_earn'
          AND created_at >= ${startDate}
      `;

      const myPoints = userPointsResult[0]?.total_points || '0';

      // 统计比当前用户积分高的人数
      const higherCountResult = await this.prisma.client.$queryRaw<
        { count: bigint }[]
      >`
        SELECT COUNT(*) as count FROM (
          SELECT
            user_id,
            SUM(CAST(amount AS DECIMAL(18,8))) as total_points
          FROM billing_logs
          WHERE
            currency = 'POINTS'
            AND billing_type = 'points_earn'
            AND created_at >= ${startDate}
          GROUP BY user_id
          HAVING SUM(CAST(amount AS DECIMAL(18,8))) > ${myPoints}
        ) as higher_users
      `;

      const higherCount = Number(higherCountResult[0]?.count || 0);

      return {
        rank: new Decimal(myPoints).gt(0) ? higherCount + 1 : null,
        points: myPoints,
      };
    }
  }

  /**
   * 隐藏邮箱中间部分
   * @param email 邮箱地址
   * @returns 隐藏后的邮箱
   */
  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '***';

    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }

    return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
  }

  /**
   * 获取最近积分获取记录
   * @param userId 用户 ID
   * @param limit 限制条数
   * @returns 积分记录列表
   */
  async getRecentPointsEarnings(userId: string, limit: number = 10) {
    const logs = await this.prisma.client.billing_logs.findMany({
      where: {
        user_id: userId,
        currency: 'POINTS',
        billing_type: 'points_earn',
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      amount: log.amount.toString(),
      description: log.description,
      referenceType: log.reference_type,
      referenceId: log.reference_id,
      createdAt: log.created_at,
    }));
  }
}
