import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { TokensService } from '../tokens/tokens.service';
import { ConfigsService } from '../configs/configs.service';
import { StakeDto, STAKE_LIMITS, ALLOWED_LOCK_DAYS, LOCK_PERIOD_WEIGHTS } from './dto/stake.dto';
import {
  StakeResponseDto,
  StakeListResponseDto,
  RewardStatsResponseDto,
} from './dto/stake-response.dto';
import Decimal from 'decimal.js';

/**
 * 质押服务
 *
 * 统一质押系统（白皮书 v5.1）：
 *
 * 积分质押（A 类）：
 * - 资产来源：points_balance（积分余额）
 * - 权重：归一化后 × 锁定期倍数（1000积分 = 1 QFI 基础权重）
 * - 解押惩罚：阶梯递减（根据锁定期和剩余时间）
 * - 锁定期：30/90/180/365 天
 *
 * 代币质押（B 类）：
 * - 资产来源：token_balance（代币余额）
 * - 权重：代币数量 × 锁定期倍数
 * - 解押惩罚：固定 3% 手续费
 * - 锁定期：30/90/180/365 天
 * - 状态：需要开关控制（ENABLE_TOKEN_STAKING 环境变量）
 *
 * 锁定期权重倍数：30天=1.2x, 90天=1.5x, 180天=2.0x, 365天=3.0x
 *
 * 分红规则：
 * - 来源：燃油费收入的 20%
 * - 周期：每周一次
 * - 分配：70% USDT 立即到账 + 30% QFI 90天释放
 */
@Injectable()
export class StakingService {
  private readonly logger = new Logger(StakingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
    @Inject(forwardRef(() => TokensService))
    private readonly tokensService: TokensService,
    private readonly configsService: ConfigsService,
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

    // 代币质押开关检查
    if (stake_type === 'B') {
      const enableTokenStaking = process.env.ENABLE_TOKEN_STAKING === 'true';
      if (!enableTokenStaking) {
        throw new BadRequestException('代币质押功能暂未开放');
      }
    }

    // 验证锁定天数（积分和代币质押都需要）
    if (lock_days === undefined || !ALLOWED_LOCK_DAYS.includes(lock_days)) {
      throw new BadRequestException(
        `锁定天数只能是 ${ALLOWED_LOCK_DAYS.join('、')} 天`,
      );
    }

    const finalLockDays = lock_days;

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
      // 权重倍数由锁定期决定（积分和代币质押相同）
      const weightMultiplier = LOCK_PERIOD_WEIGHTS[finalLockDays] || 1.0;
      const stake = await tx.stakes.create({
        data: {
          user_id: userId,
          stake_type,
          amount: amountDecimal.toNumber(),
          start_time: startTime,
          lock_period_days: finalLockDays,
          end_time: endTime,
          weight_multiplier: weightMultiplier,
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
        // A 类：阶梯递减惩罚（基于锁定期和已质押时间）
        const penaltyRate = this.calculatePointsPenaltyRate(stake);
        penaltyAmount = new Decimal(stake.amount).times(penaltyRate);
        const penaltyPercent = penaltyRate.times(100).toFixed(1);
        this.logger.warn(
          `用户 ${userId} 解押 A 类质押，锁定期 ${stake.lock_period_days} 天，惩罚率 ${penaltyPercent}%，惩罚金额 ${penaltyAmount.toString()}`,
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
   * 获取锁定期权重倍数
   * 统一模型：积分和代币质押使用相同的锁定期倍数
   *
   * @param lockDays 锁定天数
   * @returns 权重倍数
   */
  getLockPeriodWeight(lockDays: number): Decimal {
    const weight = LOCK_PERIOD_WEIGHTS[lockDays] || 1.0;
    return new Decimal(weight);
  }

  /**
   * 计算归一化权重（统一模型）
   *
   * 归一化公式：
   * - 积分质押：归一化数量 = 积分数量 / 1000（1000 积分 = 1 QFI 基础权重）
   * - 代币质押：归一化数量 = 代币数量（已经是 QFI）
   *
   * 最终权重 = 归一化数量 × 锁定期倍数
   *
   * 锁定期倍数：30天=1.2x, 90天=1.5x, 180天=2.0x, 365天=3.0x
   *
   * 示例：
   * - 质押 1000 积分，30 天锁定 → 权重 = 1 × 1.2 = 1.2
   * - 质押 1 QFI，30 天锁定 → 权重 = 1 × 1.2 = 1.2（相同）
   * - 质押 10,000 积分，90 天锁定 → 权重 = 10 × 1.5 = 15
   * - 质押 10 QFI，180 天锁定 → 权重 = 10 × 2.0 = 20
   *
   * @param stake 质押记录
   * @returns 归一化后的权重值
   */
  calculateNormalizedWeight(stake: any): Decimal {
    // 1. 归一化为 QFI 等价数量
    let qfiEquivalent: Decimal;
    if (stake.stake_type === 'A') {
      // 积分质押：1000 积分 = 1 QFI 基础权重
      qfiEquivalent = new Decimal(stake.amount).div(1000);
    } else {
      // 代币质押：已经是 QFI
      qfiEquivalent = new Decimal(stake.amount);
    }

    // 2. 获取锁定期权重倍数
    const lockWeight = this.getLockPeriodWeight(stake.lock_period_days);

    // 3. 最终权重 = 归一化数量 × 锁定期倍数
    return qfiEquivalent.times(lockWeight);
  }

  /**
   * 积分质押惩罚配置表
   * 阶梯递减：锁定期越长，到期后惩罚越低
   */
  private readonly POINTS_PENALTY_TABLE: Record<number, { early: number; mature: number }> = {
    30:  { early: 0.40, mature: 0.10 },  // 30天：提前40%，到期10%
    90:  { early: 0.30, mature: 0.05 },  // 90天：提前30%，到期5%
    180: { early: 0.20, mature: 0.02 },  // 180天：提前20%，到期2%
    365: { early: 0.10, mature: 0.00 },  // 365天：提前10%，到期0%
  };

  /**
   * 计算积分质押解押惩罚率（阶梯递减）
   *
   * 公式：实际惩罚 = 到期惩罚 + (基础惩罚 - 到期惩罚) × 剩余比例
   *
   * @param stake 质押记录
   * @returns 惩罚率（0-1）
   */
  calculatePointsPenaltyRate(stake: any): Decimal {
    const lockDays = stake.lock_period_days;
    const config = this.POINTS_PENALTY_TABLE[lockDays];

    if (!config) {
      // 未知锁定期，使用默认 50%
      return new Decimal(0.5);
    }

    const now = new Date();
    const endTime = new Date(stake.end_time);
    const isMatured = now >= endTime;

    if (isMatured) {
      // 到期后使用到期惩罚率
      return new Decimal(config.mature);
    }

    // 未到期：阶梯递减
    const startTime = new Date(stake.start_time);
    const totalDays = lockDays;
    const stakedMs = now.getTime() - startTime.getTime();
    const stakedDays = Math.floor(stakedMs / (24 * 60 * 60 * 1000));
    const remainingDays = Math.max(0, totalDays - stakedDays);
    const remainingRatio = new Decimal(remainingDays).div(totalDays);

    // 实际惩罚 = 到期惩罚 + (基础惩罚 - 到期惩罚) × 剩余比例
    const penalty = new Decimal(config.mature).plus(
      new Decimal(config.early - config.mature).times(remainingRatio)
    );

    return penalty;
  }

  /**
   * 获取质押的惩罚预览信息
   */
  getPenaltyPreview(stake: any): {
    currentPenaltyRate: string;
    maturePenaltyRate: string;
    remainingDays: number;
    isMatured: boolean;
  } {
    const now = new Date();
    const endTime = new Date(stake.end_time);
    const startTime = new Date(stake.start_time);
    const isMatured = now >= endTime;

    const totalDays = stake.lock_period_days;
    const stakedMs = now.getTime() - startTime.getTime();
    const stakedDays = Math.floor(stakedMs / (24 * 60 * 60 * 1000));
    const remainingDays = Math.max(0, totalDays - stakedDays);

    if (stake.stake_type === 'A') {
      const config = this.POINTS_PENALTY_TABLE[totalDays] || { early: 0.5, mature: 0.5 };
      const currentRate = this.calculatePointsPenaltyRate(stake);
      return {
        currentPenaltyRate: currentRate.times(100).toFixed(1),
        maturePenaltyRate: (config.mature * 100).toFixed(1),
        remainingDays,
        isMatured,
      };
    } else {
      // 代币质押固定 3%
      return {
        currentPenaltyRate: '3.0',
        maturePenaltyRate: '3.0',
        remainingDays,
        isMatured,
      };
    }
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

    // 计算归一化总权重
    let totalNormalizedWeight = new Decimal(0);
    let totalTimeFactor = new Decimal(0);
    let activeStakes = 0;

    for (const stake of stakes.filter((s) => s.status === 'active')) {
      totalNormalizedWeight = totalNormalizedWeight.plus(this.calculateNormalizedWeight(stake));
      totalTimeFactor = totalTimeFactor.plus(this.getLockPeriodWeight(stake.lock_period_days));
      activeStakes++;
    }

    // 平均时间倍率
    const averageTimeFactor =
      activeStakes > 0
        ? totalTimeFactor.dividedBy(activeStakes)
        : new Decimal(0);

    return {
      total_accumulated: claimed.plus(claimable).toString(), // 累计 = 已领取 + 待领取
      claimable: claimable.toString(),
      claimed: claimed.toString(),
      staked_amount: stakedAmount.toString(),
      average_weight: averageTimeFactor.toFixed(2), // 平均时间倍率
      normalized_weight: totalNormalizedWeight.toFixed(4), // 归一化总权重
    };
  }

  /**
   * 计算并分配收益（定时任务调用）
   *
   * 使用归一化权重计算（白皮书规则）：
   * - 1000 积分 = 1 QFI 权重
   * - B 类权重随时间递增
   *
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

      // 2. 计算每个质押的归一化权重
      const stakesWithWeight = activeStakes.map((stake) => ({
        stake,
        lockWeight: this.getLockPeriodWeight(stake.lock_period_days),
        normalizedWeight: this.calculateNormalizedWeight(stake),
      }));

      // 3. 计算总归一化权重
      const totalNormalizedWeight = stakesWithWeight.reduce(
        (sum, s) => sum.plus(s.normalizedWeight),
        new Decimal(0),
      );

      if (totalNormalizedWeight.lte(0)) {
        this.logger.warn('总归一化权重为 0，跳过收益分配');
        return { distributed: '0', stakesUpdated: 0 };
      }

      // 4. 按归一化权重分配收益
      let totalDistributed = new Decimal(0);
      let stakesUpdated = 0;

      for (const { stake, lockWeight, normalizedWeight } of stakesWithWeight) {
        // 用户收益 = 总收益 × (用户归一化权重 / 总归一化权重)
        const userReward = totalRewardDecimal
          .times(normalizedWeight)
          .dividedBy(totalNormalizedWeight)
          .toDecimalPlaces(8);

        if (userReward.gt(0)) {
          // 更新质押记录的 claimable_reward
          const currentClaimable = new Decimal(stake.claimable_reward || 0);
          const newClaimable = currentClaimable.plus(userReward);

          await tx.stakes.update({
            where: { id: stake.id },
            data: {
              claimable_reward: newClaimable.toNumber(),
              weight_multiplier: lockWeight.toNumber(), // 记录锁定期权重倍数
            },
          });

          totalDistributed = totalDistributed.plus(userReward);
          stakesUpdated++;

          this.logger.debug(
            `质押 ${stake.id} 获得收益 ${userReward.toString()} QFI（归一化权重: ${normalizedWeight.toFixed(4)}）`,
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
   *
   * 返回归一化权重统计（白皮书规则）：
   * - totalStaked: 原始质押金额（不区分类型）
   * - totalNormalizedWeight: 归一化后的总权重（1000 积分 = 1 QFI 权重）
   *
   * @returns 全局统计数据
   */
  async getGlobalStats(): Promise<{
    totalStaked: string;
    totalWeighted: string;
    totalNormalizedWeight: string;
    activeStakesCount: number;
    totalClaimable: string;
    typeAStats: { count: number; totalStaked: string; normalizedWeight: string };
    typeBStats: { count: number; totalStaked: string; normalizedWeight: string };
  }> {
    const activeStakes = await this.prisma.client.stakes.findMany({
      where: { status: 'active' },
    });

    // 总原始金额
    const totalStaked = activeStakes.reduce(
      (sum, s) => sum.plus(new Decimal(s.amount)),
      new Decimal(0),
    );

    // 归一化总权重（使用新的归一化公式）
    const totalNormalizedWeight = activeStakes.reduce(
      (sum, s) => sum.plus(this.calculateNormalizedWeight(s)),
      new Decimal(0),
    );

    // 兼容旧接口：totalWeighted（使用锁定期权重）
    const totalWeighted = activeStakes.reduce(
      (sum, s) => sum.plus(this.getLockPeriodWeight(s.lock_period_days).times(new Decimal(s.amount))),
      new Decimal(0),
    );

    const totalClaimable = activeStakes.reduce(
      (sum, s) => sum.plus(new Decimal(s.claimable_reward || 0)),
      new Decimal(0),
    );

    // 分类统计
    const typeAStakes = activeStakes.filter(s => s.stake_type === 'A');
    const typeBStakes = activeStakes.filter(s => s.stake_type === 'B');

    const typeAStats = {
      count: typeAStakes.length,
      totalStaked: typeAStakes.reduce((sum, s) => sum.plus(new Decimal(s.amount)), new Decimal(0)).toString(),
      normalizedWeight: typeAStakes.reduce((sum, s) => sum.plus(this.calculateNormalizedWeight(s)), new Decimal(0)).toString(),
    };

    const typeBStats = {
      count: typeBStakes.length,
      totalStaked: typeBStakes.reduce((sum, s) => sum.plus(new Decimal(s.amount)), new Decimal(0)).toString(),
      normalizedWeight: typeBStakes.reduce((sum, s) => sum.plus(this.calculateNormalizedWeight(s)), new Decimal(0)).toString(),
    };

    return {
      totalStaked: totalStaked.toString(),
      totalWeighted: totalWeighted.toString(), // 兼容旧接口
      totalNormalizedWeight: totalNormalizedWeight.toString(),
      activeStakesCount: activeStakes.length,
      totalClaimable: totalClaimable.toString(),
      typeAStats,
      typeBStats,
    };
  }

  // ===================== 周分红功能 =====================

  /**
   * 执行周分红分配
   *
   * 资金来源：燃油费收入的 20%（= 总收入 40% × 回购池分红 50%）
   * 分配规则：70% USDT 立即到账 + 30% QFI 90天释放
   *
   * @returns 分红结果
   */
  async distributeWeeklyDividends(): Promise<{
    totalDividend: string;
    usdtDistributed: string;
    qfiDistributed: string;
    stakersCount: number;
    success: boolean;
    message: string;
  }> {
    return await this.prisma.client.$transaction(async (tx) => {
      // 1. 计算本周燃油费总收入
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const gasFees = await tx.billing_logs.aggregate({
        where: {
          billing_type: 'gas_fee',
          created_at: { gte: weekAgo },
          status: 'completed',
        },
        _sum: { amount: true },
      });

      const totalGasFee = new Decimal(gasFees._sum.amount || 0);
      if (totalGasFee.lte(0)) {
        this.logger.log('本周无燃油费收入，跳过分红');
        return {
          totalDividend: '0',
          usdtDistributed: '0',
          qfiDistributed: '0',
          stakersCount: 0,
          success: true,
          message: '本周无燃油费收入',
        };
      }

      // 2. 计算分红池 = 燃油费 × 20%（白皮书：40%回购池 × 50%分红）
      const dividendPool = totalGasFee.times(0.2);

      this.logger.log(
        `本周燃油费收入: ${totalGasFee.toString()} USDT, 分红池: ${dividendPool.toString()} USDT`,
      );

      // 3. 获取所有活跃质押，计算归一化权重
      const activeStakes = await tx.stakes.findMany({
        where: { status: 'active' },
      });

      if (activeStakes.length === 0) {
        this.logger.log('无活跃质押，跳过分红');
        return {
          totalDividend: dividendPool.toString(),
          usdtDistributed: '0',
          qfiDistributed: '0',
          stakersCount: 0,
          success: true,
          message: '无活跃质押者',
        };
      }

      // 4. 计算总归一化权重
      const stakesWithWeight = activeStakes.map((stake) => ({
        stake,
        normalizedWeight: this.calculateNormalizedWeight(stake),
      }));

      const totalWeight = stakesWithWeight.reduce(
        (sum, s) => sum.plus(s.normalizedWeight),
        new Decimal(0),
      );

      if (totalWeight.lte(0)) {
        this.logger.warn('总归一化权重为 0，跳过分红');
        return {
          totalDividend: dividendPool.toString(),
          usdtDistributed: '0',
          qfiDistributed: '0',
          stakersCount: 0,
          success: false,
          message: '总归一化权重为 0',
        };
      }

      // 5. 获取 QFI 价格
      const qfiPrice = await this.configsService.getQFIPrice();

      // 6. 按权重分配
      let totalUsdtDistributed = new Decimal(0);
      let totalQfiDistributed = new Decimal(0);
      const userDividends: Map<string, { usdt: Decimal; qfi: Decimal }> = new Map();

      for (const { stake, normalizedWeight } of stakesWithWeight) {
        // 用户分红 = 分红池 × (用户权重 / 总权重)
        const userDividend = dividendPool
          .times(normalizedWeight)
          .div(totalWeight)
          .toDecimalPlaces(8);

        if (userDividend.gt(0)) {
          // 70% USDT 立即到账
          const usdtReward = userDividend.times(0.7).toDecimalPlaces(8);

          // 30% 转换为 QFI
          const qfiValue = userDividend.times(0.3);
          const qfiAmount = qfiValue.div(qfiPrice).toDecimalPlaces(8);

          // 累计到用户
          const existing = userDividends.get(stake.user_id) || {
            usdt: new Decimal(0),
            qfi: new Decimal(0),
          };
          userDividends.set(stake.user_id, {
            usdt: existing.usdt.plus(usdtReward),
            qfi: existing.qfi.plus(qfiAmount),
          });

          totalUsdtDistributed = totalUsdtDistributed.plus(usdtReward);
          totalQfiDistributed = totalQfiDistributed.plus(qfiAmount);
        }
      }

      // 7. 批量更新钱包和创建释放订单
      for (const [userId, dividend] of userDividends) {
        // 70% USDT 立即到账
        if (dividend.usdt.gt(0)) {
          await tx.wallets.update({
            where: { user_id: userId },
            data: { usdt_balance: { increment: dividend.usdt.toNumber() } },
          });
        }

        // 30% QFI 创建 90 天释放订单
        if (dividend.qfi.gt(0)) {
          await this.tokensService.createDividendVestingOrder(
            userId,
            dividend.qfi,
            90, // 90 天释放
            'weekly_reward',
          );
        }
      }

      // 8. 记录分红日志
      const now = new Date();
      await tx.revenue_distributions.create({
        data: {
          period_start: weekAgo,
          period_end: now,
          total_revenue: totalGasFee.toString(),
          operations_amount: '0',
          buyback_amount: dividendPool.toString(),
          reserve_amount: '0',
          tokens_distributed: totalQfiDistributed.toString(),
          distribution_type: 'weekly_dividend',
          usdt_distributed: totalUsdtDistributed.toString(),
          qfi_distributed: totalQfiDistributed.toString(),
          stakers_count: userDividends.size,
          status: 'completed',
        },
      });

      const message = `周分红完成: 分红池 ${dividendPool.toFixed(2)} USDT, ` +
        `分配 USDT ${totalUsdtDistributed.toFixed(2)}, QFI ${totalQfiDistributed.toFixed(4)}, ` +
        `惠及 ${userDividends.size} 人`;

      this.logger.log(message);

      return {
        totalDividend: dividendPool.toString(),
        usdtDistributed: totalUsdtDistributed.toString(),
        qfiDistributed: totalQfiDistributed.toString(),
        stakersCount: userDividends.size,
        success: true,
        message,
      };
    });
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
