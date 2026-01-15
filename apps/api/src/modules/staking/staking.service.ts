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
   * 计算时间倍率（B 类 veToken 模型）
   * weight = min(1.0 + (已质押天数 / 180), 3.0)
   *
   * @param stake 质押记录
   * @returns 时间倍率
   */
  calculateTimeFactor(stake: any): Decimal {
    if (stake.stake_type === 'A') {
      return new Decimal(1.0); // A 类固定 1.0x
    }

    // B 类：随时间递增 (veToken 模型)
    // 公式: min(1.0 + 已质押天数/180, 3.0)
    // 即：质押满 180 天达到 2.0x，质押满 360 天达到 3.0x 上限
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
   * 计算权重乘数（兼容旧逻辑，等同于 calculateTimeFactor）
   * @deprecated 使用 calculateTimeFactor 或 calculateNormalizedWeight
   */
  calculateWeight(stake: any): Decimal {
    return this.calculateTimeFactor(stake);
  }

  /**
   * 计算归一化权重（白皮书规则）
   *
   * 归一化公式：
   * - A 类归一化数量 = 积分数量 / 1000（1000 积分 = 1 QFI 权重）
   * - B 类归一化数量 = 代币数量（已经是 QFI）
   *
   * 最终权重 = 归一化数量 × 时间倍率
   *
   * 示例：
   * - 质押 10,000 积分（A类） → 权重 = 10 × 1.0 = 10
   * - 质押 10 QFI（B类，已质押 90 天） → 时间倍率 = 1.5 → 权重 = 10 × 1.5 = 15
   * - 质押 10 QFI（B类，已质押 180 天） → 时间倍率 = 2.0 → 权重 = 10 × 2.0 = 20
   * - 质押 10 QFI（B类，已质押 360+ 天） → 时间倍率 = 3.0 → 权重 = 10 × 3.0 = 30
   *
   * @param stake 质押记录
   * @returns 归一化后的权重值
   */
  calculateNormalizedWeight(stake: any): Decimal {
    // 1. 归一化为 QFI 等价数量
    let qfiEquivalent: Decimal;
    if (stake.stake_type === 'A') {
      // A 类：1000 积分 = 1 QFI 权重
      qfiEquivalent = new Decimal(stake.amount).div(1000);
    } else {
      // B 类：已经是 QFI
      qfiEquivalent = new Decimal(stake.amount);
    }

    // 2. 计算时间倍率
    const timeFactor = this.calculateTimeFactor(stake);

    // 3. 最终权重 = 归一化数量 × 时间倍率
    return qfiEquivalent.times(timeFactor);
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
      totalTimeFactor = totalTimeFactor.plus(this.calculateTimeFactor(stake));
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
        timeFactor: this.calculateTimeFactor(stake),
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

      for (const { stake, timeFactor, normalizedWeight } of stakesWithWeight) {
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
              weight_multiplier: timeFactor.toNumber(), // 记录时间倍率
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

    // 兼容旧接口：totalWeighted
    const totalWeighted = activeStakes.reduce(
      (sum, s) => sum.plus(this.calculateWeight(s).times(new Decimal(s.amount))),
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
