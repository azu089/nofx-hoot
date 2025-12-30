import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { StakeDto, STAKE_LIMITS, ALLOWED_LOCK_DAYS } from './dto/stake.dto';
import {
  StakeResponseDto,
  StakeListResponseDto,
  RewardStatsResponseDto,
} from './dto/stake-response.dto';
import Decimal from 'decimal.js';

/**
 * 质押服务
 *
 * 双轨质押系统（白皮书 v5.0 第 3.3 节）：
 *
 * A 类（积分质押）：
 * - 资产来源：points_balance（积分余额）
 * - 权重：固定 1.0x
 * - 解押惩罚：扣除 50% 本金（销毁）
 * - 锁定期：无（随时可解押）
 * - 状态：V1 开放
 *
 * B 类（代币质押）：
 * - 资产来源：token_balance（代币余额）
 * - 权重：1.0x-3.0x，公式 = min(1.0 + 已质押天数/180, 3.0)
 * - 解押惩罚：仅 3% 手续费（无论是否到期）
 * - 锁定期：用户选择（30/90/180/365 天）
 * - 状态：需要开关控制（ENABLE_TOKEN_STAKING 环境变量）
 *
 * 分红规则：
 * - 来源：燃油费（盈利抽成）的 30%
 * - 周期：每周一次
 * - 结算：USDT（直接打入 usdt_balance）
 */
@Injectable()
export class StakingService {
  private readonly logger = new Logger(StakingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
  ) {}

  /**
   * 质押
   *
   * A 类：使用积分余额（points_balance），锁入 points_locked
   * B 类：使用代币余额（token_balance），锁入 token_locked
   *
   * @param userId 用户 ID
   * @param dto 质押参数
   * @returns 质押记录
   */
  async stake(userId: string, dto: StakeDto): Promise<StakeResponseDto> {
    const { amount, stake_type, lock_days } = dto;

    // 验证金额
    const amountDecimal = new Decimal(amount);
    if (amountDecimal.lte(0)) {
      throw new BadRequestException('质押金额必须大于 0');
    }

    // 验证金额范围
    const minAmount = new Decimal(STAKE_LIMITS.MIN_AMOUNT);
    const maxAmount = new Decimal(STAKE_LIMITS.MAX_AMOUNT);
    if (amountDecimal.lt(minAmount)) {
      throw new BadRequestException(`质押金额不能低于 ${STAKE_LIMITS.MIN_AMOUNT}`);
    }
    if (amountDecimal.gt(maxAmount)) {
      throw new BadRequestException(`质押金额不能超过 ${STAKE_LIMITS.MAX_AMOUNT}`);
    }

    // B 类开关检查
    if (stake_type === 'B') {
      const enableTokenStaking = process.env.ENABLE_TOKEN_STAKING === 'true';
      if (!enableTokenStaking) {
        throw new BadRequestException('代币质押功能暂未开放');
      }
    }

    // B 类必须提供锁定天数，且在白名单内
    if (stake_type === 'B') {
      if (lock_days === undefined || lock_days <= 0) {
        throw new BadRequestException('B 类质押必须设置锁定天数（大于 0）');
      }
      if (!ALLOWED_LOCK_DAYS.includes(lock_days)) {
        throw new BadRequestException(
          `B 类质押锁定天数只能是 ${ALLOWED_LOCK_DAYS.join('、')} 天`,
        );
      }
    }

    // A 类锁定天数固定为 0
    const finalLockDays = stake_type === 'A' ? 0 : lock_days!;

    // 计算结束时间
    const startTime = new Date();
    const endTime = new Date(
      startTime.getTime() + finalLockDays * 24 * 60 * 60 * 1000,
    );

    // 使用事务
    return await this.prisma.client.$transaction(async (tx) => {
      // 1. 检查钱包余额
      const wallet = await tx.wallets.findUnique({
        where: { user_id: userId },
      });

      if (!wallet) {
        throw new NotFoundException('钱包不存在');
      }

      // A 类使用积分，B 类使用代币
      if (stake_type === 'A') {
        const pointsBalance = new Decimal(wallet.points_balance);
        if (pointsBalance.lt(amountDecimal)) {
          throw new BadRequestException('积分余额不足');
        }

        // 扣除 points_balance，增加 points_locked
        await tx.wallets.update({
          where: { user_id: userId },
          data: {
            points_balance: {
              decrement: amountDecimal.toNumber(),
            },
            points_locked: {
              increment: amountDecimal.toNumber(),
            },
          },
        });
      } else {
        // B 类：使用代币
        const tokenBalance = new Decimal(wallet.token_balance);
        if (tokenBalance.lt(amountDecimal)) {
          throw new BadRequestException('代币余额不足');
        }

        // 扣除 token_balance，增加 token_locked
        await tx.wallets.update({
          where: { user_id: userId },
          data: {
            token_balance: {
              decrement: amountDecimal.toNumber(),
            },
            token_locked: {
              increment: amountDecimal.toNumber(),
            },
          },
        });
      }

      // 3. 创建质押记录
      const stake = await tx.stakes.create({
        data: {
          user_id: userId,
          stake_type,
          amount: amountDecimal.toNumber(),
          start_time: startTime,
          lock_period_days: finalLockDays,
          end_time: endTime,
          weight_multiplier: stake_type === 'A' ? 1.0 : 1.0, // 初始权重（B 类会动态计算）
          accumulated_reward: 0,
          status: 'active',
        },
      });

      const assetType = stake_type === 'A' ? '积分' : '代币';
      this.logger.log(
        `用户 ${userId} ${assetType}质押成功：${stake_type} 类，金额 ${amount}，锁定 ${finalLockDays} 天`,
      );

      return this.mapToResponseDto(stake);
    });
  }

  /**
   * 解押
   *
   * 惩罚规则：
   * - A 类（积分质押）：扣除 50% 本金（销毁），返还剩余 50% 到 points_balance
   * - B 类（代币质押）：仅扣 3% 手续费，返还 97% 到 token_balance（无论是否到期）
   *
   * @param stakeId 质押记录 ID
   * @param userId 用户 ID
   * @returns 解押结果（包含惩罚金额）
   */
  async unstake(
    stakeId: string,
    userId: string,
  ): Promise<{ stake: StakeResponseDto; penalty: string; returnAmount: string }> {
    return await this.prisma.client.$transaction(async (tx) => {
      // 1. 查询质押记录
      const stake = await tx.stakes.findUnique({
        where: { id: stakeId },
      });

      if (!stake) {
        throw new NotFoundException('质押记录不存在');
      }

      if (stake.user_id !== userId) {
        throw new BadRequestException('无权操作此质押记录');
      }

      if (stake.status !== 'active') {
        throw new BadRequestException('质押记录状态不正确');
      }

      // 2. 计算惩罚金额
      let penaltyAmount = new Decimal(0);
      const now = new Date();
      const isEarly = now < stake.end_time;

      if (stake.stake_type === 'A') {
        // A 类：扣除 50% 本金（销毁）
        penaltyAmount = new Decimal(stake.amount).times(0.5);
        this.logger.warn(
          `用户 ${userId} 解押 A 类质押，50% 本金销毁，惩罚金额 ${penaltyAmount.toString()}`,
        );
      } else if (stake.stake_type === 'B') {
        // B 类：仅扣 3% 手续费（无论是否到期）
        penaltyAmount = new Decimal(stake.amount).times(0.03);
        this.logger.log(
          `用户 ${userId} 解押 B 类质押，扣除 3% 手续费 ${penaltyAmount.toString()}`,
        );
      }

      // 3. 计算实际返还金额
      const returnAmount = new Decimal(stake.amount).minus(penaltyAmount);

      // 4. 根据质押类型更新对应的钱包字段
      if (stake.stake_type === 'A') {
        // A 类：points_locked -> points_balance
        await tx.wallets.update({
          where: { user_id: userId },
          data: {
            points_locked: {
              decrement: new Decimal(stake.amount).toNumber(),
            },
            points_balance: {
              increment: returnAmount.toNumber(),
            },
          },
        });
      } else {
        // B 类：token_locked -> token_balance
        await tx.wallets.update({
          where: { user_id: userId },
          data: {
            token_locked: {
              decrement: new Decimal(stake.amount).toNumber(),
            },
            token_balance: {
              increment: returnAmount.toNumber(),
            },
          },
        });
      }

      // 5. 更新质押记录
      const updatedStake = await tx.stakes.update({
        where: { id: stakeId },
        data: {
          status: 'unstaked',
          early_unstake_at: isEarly ? now : undefined,
          penalty_amount: penaltyAmount.toNumber(),
        },
      });

      const assetType = stake.stake_type === 'A' ? '积分' : '代币';
      this.logger.log(
        `用户 ${userId} ${assetType}解押成功：返还 ${returnAmount.toString()}，惩罚 ${penaltyAmount.toString()}`,
      );

      return {
        stake: this.mapToResponseDto(updatedStake),
        penalty: penaltyAmount.toString(),
        returnAmount: returnAmount.toString(),
      };
    });
  }

  /**
   * 计算权重（B 类）
   * weight = min(1.0 + (已质押天数 / 180), 3.0)
   *
   * @param stake 质押记录
   * @returns 权重乘数
   */
  calculateWeight(stake: any): Decimal {
    if (stake.stake_type === 'A') {
      return new Decimal(1.0);
    }

    // B 类：随时间递增
    const now = new Date();
    const stakedDays = Math.floor(
      (now.getTime() - stake.start_time.getTime()) / (24 * 60 * 60 * 1000),
    );

    const weight = new Decimal(1.0).plus(
      new Decimal(stakedDays).dividedBy(180),
    );

    // 最高 3.0x
    return Decimal.min(weight, new Decimal(3.0));
  }

  /**
   * 领取收益
   * @param userId 用户 ID
   * @returns 领取金额
   */
  async claimRewards(userId: string): Promise<{ amount: string; stakes: number }> {
    return await this.prisma.client.$transaction(async (tx) => {
      // 1. 获取用户所有 active 质押记录（有待领取收益的）
      const stakes = await tx.stakes.findMany({
        where: {
          user_id: userId,
          status: 'active',
          claimable_reward: {
            gt: 0,
          },
        },
      });

      if (stakes.length === 0) {
        return { amount: '0.00000000', stakes: 0 };
      }

      // 2. 计算总可领取收益
      const totalClaimable = stakes.reduce(
        (sum, s) => sum.plus(new Decimal(s.claimable_reward || 0)),
        new Decimal(0),
      );

      if (totalClaimable.lte(0)) {
        return { amount: '0.00000000', stakes: 0 };
      }

      // 3. 更新钱包：增加代币余额
      await tx.wallets.update({
        where: { user_id: userId },
        data: {
          token_balance: {
            increment: totalClaimable.toNumber(),
          },
        },
      });

      // 4. 更新质押记录：清空 claimable_reward，累加到 accumulated_reward
      for (const stake of stakes) {
        const claimable = new Decimal(stake.claimable_reward || 0);
        const accumulated = new Decimal(stake.accumulated_reward || 0);

        await tx.stakes.update({
          where: { id: stake.id },
          data: {
            claimable_reward: 0,
            accumulated_reward: accumulated.plus(claimable).toNumber(),
            last_reward_at: new Date(),
          },
        });
      }

      // 5. 创建领取记录
      await tx.billing_logs.create({
        data: {
          user_id: userId,
          unique_order_id: `staking_claim_${userId}_${Date.now()}`,
          billing_type: 'staking_claim',
          amount: totalClaimable.toString(),
          currency: 'QFI',
          description: `领取质押收益：${stakes.length} 笔质押`,
          status: 'completed',
        },
      });

      this.logger.log(
        `用户 ${userId} 领取质押收益 ${totalClaimable.toString()} QFI，共 ${stakes.length} 笔`,
      );

      return {
        amount: totalClaimable.toString(),
        stakes: stakes.length,
      };
    });
  }

  /**
   * 查询用户质押列表
   * @param userId 用户 ID
   * @returns 质押列表
   */
  async getStakes(userId: string): Promise<StakeListResponseDto> {
    const stakes = await this.prisma.client.stakes.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    const stakeDtos = stakes.map((stake) => this.mapToResponseDto(stake));

    // 计算总质押和总收益
    const totalStaked = stakes
      .filter((s) => s.status === 'active')
      .reduce(
        (sum, s) => sum.plus(new Decimal(s.amount)),
        new Decimal(0),
      );

    const totalReward = stakes.reduce(
      (sum, s) => sum.plus(new Decimal(s.accumulated_reward)),
      new Decimal(0),
    );

    return {
      stakes: stakeDtos,
      total_staked: totalStaked.toString(),
      total_reward: totalReward.toString(),
    };
  }

  /**
   * 获取收益统计
   * @param userId 用户 ID
   * @returns 收益统计
   */
  async getRewardStats(userId: string): Promise<RewardStatsResponseDto> {
    const stakes = await this.prisma.client.stakes.findMany({
      where: { user_id: userId },
    });

    // 计算已领取收益（accumulated_reward）
    const claimed = stakes.reduce(
      (sum, s) => sum.plus(new Decimal(s.accumulated_reward || 0)),
      new Decimal(0),
    );

    // 计算可领取收益（claimable_reward）
    const claimable = stakes
      .filter((s) => s.status === 'active')
      .reduce(
        (sum, s) => sum.plus(new Decimal(s.claimable_reward || 0)),
        new Decimal(0),
      );

    // 计算质押中金额
    const stakedAmount = stakes
      .filter((s) => s.status === 'active')
      .reduce(
        (sum, s) => sum.plus(new Decimal(s.amount)),
        new Decimal(0),
      );

    // 计算平均权重
    let totalWeight = new Decimal(0);
    let activeStakes = 0;

    for (const stake of stakes.filter((s) => s.status === 'active')) {
      const weight = this.calculateWeight(stake);
      totalWeight = totalWeight.plus(weight);
      activeStakes++;
    }

    const averageWeight =
      activeStakes > 0
        ? totalWeight.dividedBy(activeStakes)
        : new Decimal(0);

    return {
      total_accumulated: claimed.plus(claimable).toString(), // 累计 = 已领取 + 待领取
      claimable: claimable.toString(),
      claimed: claimed.toString(),
      staked_amount: stakedAmount.toString(),
      average_weight: averageWeight.toFixed(2),
    };
  }

  /**
   * 计算并分配收益（定时任务调用）
   * @param totalReward 本期总收益（来自收入分配池）
   * @returns 分配结果
   */
  async calculateRewards(totalReward: string = '0'): Promise<{
    distributed: string;
    stakesUpdated: number;
  }> {
    const totalRewardDecimal = new Decimal(totalReward);

    if (totalRewardDecimal.lte(0)) {
      this.logger.log('本期无收益可分配');
      return { distributed: '0', stakesUpdated: 0 };
    }

    return await this.prisma.client.$transaction(async (tx) => {
      // 1. 获取所有 active 质押
      const activeStakes = await tx.stakes.findMany({
        where: { status: 'active' },
      });

      if (activeStakes.length === 0) {
        this.logger.log('无活跃质押，跳过收益分配');
        return { distributed: '0', stakesUpdated: 0 };
      }

      // 2. 计算每个质押的权重
      const stakesWithWeight = activeStakes.map((stake) => ({
        stake,
        weight: this.calculateWeight(stake),
        weightedAmount: this.calculateWeight(stake).times(new Decimal(stake.amount)),
      }));

      // 3. 计算总加权金额
      const totalWeightedAmount = stakesWithWeight.reduce(
        (sum, s) => sum.plus(s.weightedAmount),
        new Decimal(0),
      );

      if (totalWeightedAmount.lte(0)) {
        this.logger.warn('总加权金额为 0，跳过收益分配');
        return { distributed: '0', stakesUpdated: 0 };
      }

      // 4. 按权重分配收益
      let totalDistributed = new Decimal(0);
      let stakesUpdated = 0;

      for (const { stake, weightedAmount } of stakesWithWeight) {
        // 用户收益 = 总收益 × (用户加权金额 / 总加权金额)
        const userReward = totalRewardDecimal
          .times(weightedAmount)
          .dividedBy(totalWeightedAmount)
          .toDecimalPlaces(8);

        if (userReward.gt(0)) {
          // 更新质押记录的 claimable_reward
          const currentClaimable = new Decimal(stake.claimable_reward || 0);
          const newClaimable = currentClaimable.plus(userReward);

          await tx.stakes.update({
            where: { id: stake.id },
            data: {
              claimable_reward: newClaimable.toNumber(),
              weight_multiplier: this.calculateWeight(stake).toNumber(),
            },
          });

          totalDistributed = totalDistributed.plus(userReward);
          stakesUpdated++;

          this.logger.debug(
            `质押 ${stake.id} 获得收益 ${userReward.toString()} QFI`,
          );
        }
      }

      this.logger.log(
        `收益分配完成：总分配 ${totalDistributed.toString()} QFI，更新 ${stakesUpdated} 笔质押`,
      );

      return {
        distributed: totalDistributed.toString(),
        stakesUpdated,
      };
    });
  }

  /**
   * 获取全局质押统计（用于收益分配）
   * @returns 全局统计数据
   */
  async getGlobalStats(): Promise<{
    totalStaked: string;
    totalWeighted: string;
    activeStakesCount: number;
    totalClaimable: string;
  }> {
    const activeStakes = await this.prisma.client.stakes.findMany({
      where: { status: 'active' },
    });

    const totalStaked = activeStakes.reduce(
      (sum, s) => sum.plus(new Decimal(s.amount)),
      new Decimal(0),
    );

    const totalWeighted = activeStakes.reduce(
      (sum, s) => sum.plus(this.calculateWeight(s).times(new Decimal(s.amount))),
      new Decimal(0),
    );

    const totalClaimable = activeStakes.reduce(
      (sum, s) => sum.plus(new Decimal(s.claimable_reward || 0)),
      new Decimal(0),
    );

    return {
      totalStaked: totalStaked.toString(),
      totalWeighted: totalWeighted.toString(),
      activeStakesCount: activeStakes.length,
      totalClaimable: totalClaimable.toString(),
    };
  }

  /**
   * 映射到响应 DTO
   *
   * 惩罚计算规则：
   * - A 类（积分质押）：扣除 50% 本金（销毁）
   * - B 类（代币质押）：仅扣 3% 手续费（无论是否到期）
   */
  private mapToResponseDto(stake: any): StakeResponseDto {
    // 计算解押惩罚金额预览
    let earlyPenalty: string | undefined;
    if (stake.status === 'active') {
      if (stake.stake_type === 'A') {
        // A 类：50% 本金销毁
        earlyPenalty = new Decimal(stake.amount).times(0.5).toString();
      } else if (stake.stake_type === 'B') {
        // B 类：仅 3% 手续费（无论是否到期）
        earlyPenalty = new Decimal(stake.amount).times(0.03).toString();
      }
    }

    // 计算返还金额预览
    let returnPreview: string | undefined;
    if (stake.status === 'active' && earlyPenalty) {
      returnPreview = new Decimal(stake.amount).minus(earlyPenalty).toString();
    }

    return {
      id: stake.id,
      stake_type: stake.stake_type,
      amount: stake.amount.toString(),
      start_time: stake.start_time,
      lock_period_days: stake.lock_period_days,
      end_time: stake.end_time,
      weight_multiplier: stake.weight_multiplier.toString(),
      accumulated_reward: stake.accumulated_reward.toString(),
      claimable_reward: stake.claimable_reward?.toString() || '0',
      status: stake.status,
      early_unstake_at: stake.early_unstake_at,
      penalty_amount: stake.penalty_amount?.toString(),
      created_at: stake.created_at,
      can_unstake: true, // 始终可解押（但有不同惩罚）
      early_penalty: earlyPenalty,
      return_preview: returnPreview,
    };
  }
}
