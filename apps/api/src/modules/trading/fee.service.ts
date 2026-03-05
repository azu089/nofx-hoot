import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Decimal from 'decimal.js';
import { randomBytes } from 'crypto';

// 手续费配置
export const FEE_CONFIG = {
  // 基础手续费率（按会员层级）
  FREE_GAS_FEE_RATE: new Decimal('0.25'), // 25% — Free 用户
  PRO_GAS_FEE_RATE: new Decimal('0.20'),  // 20% — Pro 用户

  // HOOT 质押用户折扣（有活跃质押即享）
  STAKING_DISCOUNT: new Decimal('0.10'), // 10% 折扣

  // VIP 折扣（按质押金额）
  VIP_DISCOUNT_TIERS: [
    { minStake: new Decimal('10000'), discount: new Decimal('0.05') }, // >= 10000 HOOT: 5% 折扣
    { minStake: new Decimal('50000'), discount: new Decimal('0.10') }, // >= 50000 HOOT: 10% 折扣
    { minStake: new Decimal('100000'), discount: new Decimal('0.15') }, // >= 100000 HOOT: 15% 折扣
  ],

  // 最小手续费
  MIN_FEE: new Decimal('0.01'), // 0.01 USDT
};

export interface FeeCalculationResult {
  profit: string; // 盈利金额
  baseFeeRate: string; // 基础费率
  stakingDiscount: string; // 质押折扣
  vipDiscount: string; // VIP 折扣
  finalFeeRate: string; // 最终费率
  feeAmount: string; // 手续费金额
  netProfit: string; // 净利润
}

export interface FeeRecord {
  userId: string;
  positionId: string;
  profit: string;
  feeRate: string;
  feeAmount: string;
  uniqueOrderId: string;
  strategyName?: string; // 策略名称（交易对），用于账单备注
}

@Injectable()
export class FeeService {
  private readonly logger = new Logger(FeeService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 计算交易手续费
   * @param userId 用户 ID
   * @param profit 盈利金额（USDT）
   * @returns 手续费计算结果
   */
  async calculateFee(
    userId: string,
    profit: string,
  ): Promise<FeeCalculationResult> {
    const profitDecimal = new Decimal(profit);

    // 根据会员状态获取基础费率
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { membershipStatus: true, membershipExpireAt: true },
    });
    const isPro = user?.membershipStatus === 'active'
      && user.membershipExpireAt != null
      && user.membershipExpireAt > new Date();
    const baseFeeRateForUser = isPro
      ? FEE_CONFIG.PRO_GAS_FEE_RATE
      : FEE_CONFIG.FREE_GAS_FEE_RATE;

    // 如果亏损，不收手续费
    if (profitDecimal.lte(0)) {
      return {
        profit,
        baseFeeRate: baseFeeRateForUser.toString(),
        stakingDiscount: '0',
        vipDiscount: '0',
        finalFeeRate: '0',
        feeAmount: '0',
        netProfit: profit,
      };
    }

    // 获取用户质押信息
    const stakingInfo = await this.getUserStakingInfo(userId);

    // 计算质押折扣（有活跃 HOOT 质押即享折扣）
    let stakingDiscount = new Decimal(0);
    if (stakingInfo.hasActiveStake) {
      stakingDiscount = FEE_CONFIG.STAKING_DISCOUNT;
    }

    // 计算 VIP 折扣
    let vipDiscount = new Decimal(0);
    for (const tier of FEE_CONFIG.VIP_DISCOUNT_TIERS) {
      if (stakingInfo.totalStaked.gte(tier.minStake)) {
        vipDiscount = tier.discount;
      }
    }

    // 计算最终费率
    const baseFeeRate = baseFeeRateForUser;
    const totalDiscount = stakingDiscount.plus(vipDiscount);
    let finalFeeRate = baseFeeRate.minus(baseFeeRate.times(totalDiscount));

    // 费率不能低于 0
    if (finalFeeRate.lt(0)) {
      finalFeeRate = new Decimal(0);
    }

    // 计算手续费金额
    let feeAmount = profitDecimal.times(finalFeeRate);

    // 应用最小手续费
    if (feeAmount.gt(0) && feeAmount.lt(FEE_CONFIG.MIN_FEE)) {
      feeAmount = FEE_CONFIG.MIN_FEE;
    }

    // 向上取整到 0.01（用户友好展示，统一精度）
    if (feeAmount.gt(0)) {
      feeAmount = feeAmount.toDecimalPlaces(2, Decimal.ROUND_UP);
    }

    // 计算净利润
    const netProfit = profitDecimal.minus(feeAmount);

    return {
      profit,
      baseFeeRate: baseFeeRate.toString(),
      stakingDiscount: stakingDiscount.toString(),
      vipDiscount: vipDiscount.toString(),
      finalFeeRate: finalFeeRate.toString(),
      feeAmount: feeAmount.toFixed(8),
      netProfit: netProfit.toFixed(8),
    };
  }

  /**
   * 扣除手续费（幂等性）
   * @param feeRecord 手续费记录
   */
  async chargeFee(feeRecord: FeeRecord): Promise<{ ok: boolean; balanceDepleted: boolean }> {
    const { userId, positionId, profit, feeRate, feeAmount, uniqueOrderId } =
      feeRecord;

    // 检查是否已处理（幂等性）
    const existingLog = await this.prisma.billingLog.findUnique({
      where: { uniqueOrderId },
    });

    if (existingLog) {
      this.logger.warn(`手续费已处理: ${uniqueOrderId}`);
      return { ok: false, balanceDepleted: false };
    }

    const feeAmountDecimal = new Decimal(feeAmount);

    // 如果手续费为 0，不扣费
    if (feeAmountDecimal.lte(0)) {
      return { ok: true, balanceDepleted: false };
    }

    let balanceDepleted = false;

    // 使用事务扣费
    await this.prisma.$transaction(async (tx) => {
      // 获取用户余额（点卡余额）
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { pointBalance: true },
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      const currentPointBalance = new Decimal(user.pointBalance.toString());

      // 计算实际扣除金额（不能超过当前余额）
      const actualDeduction = Decimal.min(currentPointBalance, feeAmountDecimal);

      // 余额不足标记
      if (currentPointBalance.lt(feeAmountDecimal)) {
        balanceDepleted = true;
        this.logger.warn(
          `用户 ${userId} 点卡余额不足: 当前 ${currentPointBalance} < 应扣 ${feeAmountDecimal}，实扣 ${actualDeduction}`,
        );
      }

      // 扣除点卡余额（使用精确计算避免浮点误差）
      if (actualDeduction.gt(0)) {
        const newPointBalance = currentPointBalance.minus(actualDeduction);
        await tx.user.update({
          where: { id: userId },
          data: {
            pointBalance: newPointBalance.toFixed(8),
          },
        });
      }

      // 创建扣费日志
      await tx.billingLog.create({
        data: {
          userId,
          type: 'GAS_FEE',
          amount: actualDeduction,
          uniqueOrderId,
          description: `持仓 ${positionId} 盈利 ${profit} 手续费率 ${feeRate} 应扣 ${feeAmount} 实扣 ${actualDeduction}`,
        },
      });

      // 同步写入 Transaction 表（前端历史账单统一从 Transaction 查询）
      await tx.transaction.create({
        data: {
          userId,
          type: 'gas_fee',
          asset: 'POINT',
          amount: actualDeduction.negated(),
          uniqueOrderId,
          status: 'completed',
          remark: `${feeRecord.strategyName ? (feeRecord.strategyName.split('/')[0] + ' ') : ''}盈利${profit} · 费率${feeRate}`,
        },
      });

      this.logger.log(
        `燃油费已扣除: 用户 ${userId} 点卡扣除 ${actualDeduction} USDT`,
      );
    });

    return { ok: true, balanceDepleted };
  }

  /**
   * 获取用户质押信息
   */
  private async getUserStakingInfo(userId: string): Promise<{
    hasActiveStake: boolean;
    totalStaked: Decimal;
  }> {
    const stakingRecords = await this.prisma.stakingRecord.findMany({
      where: {
        userId,
        status: { in: ['active', 'locked'] },
      },
    });

    if (stakingRecords.length === 0) {
      return {
        hasActiveStake: false,
        totalStaked: new Decimal(0),
      };
    }

    // 计算总质押量
    const totalStaked = stakingRecords.reduce(
      (sum, record) => sum.plus(new Decimal(record.amount.toString())),
      new Decimal(0),
    );

    return {
      hasActiveStake: true,
      totalStaked,
    };
  }

  /**
   * 生成幂等性订单 ID
   * @param type 类型
   * @param userId 用户 ID
   * @param positionId 持仓 ID
   */
  generateUniqueOrderId(
    type: string,
    userId: string,
    positionId: string,
  ): string {
    const timestamp = Date.now();
    const nonce = randomBytes(8).toString('hex');
    return `${type}_${userId}_${positionId}_${timestamp}_${nonce}`;
  }

  /**
   * 获取用户手续费统计
   */
  async getUserFeeStats(userId: string): Promise<{
    totalFeesPaid: string;
    feeCount: number;
    averageFeeRate: string;
  }> {
    const logs = await this.prisma.billingLog.findMany({
      where: {
        userId,
        type: 'GAS_FEE',
      },
    });

    if (logs.length === 0) {
      return {
        totalFeesPaid: '0',
        feeCount: 0,
        averageFeeRate: '0',
      };
    }

    const totalFees = logs.reduce(
      (sum, log) => sum.plus(new Decimal(log.amount)),
      new Decimal(0),
    );

    // 从 description 中解析费率来计算平均费率
    // description 格式: 持仓 xxx 盈利 xxx 手续费 xxx = xxx
    let totalRate = new Decimal(0);
    let rateCount = 0;

    for (const log of logs) {
      const match = log.description?.match(/手续费 ([\d.]+) =/);
      if (match) {
        totalRate = totalRate.plus(new Decimal(match[1]));
        rateCount++;
      }
    }

    const averageRate =
      rateCount > 0 ? totalRate.div(rateCount) : new Decimal(0);

    return {
      totalFeesPaid: totalFees.toFixed(8),
      feeCount: logs.length,
      averageFeeRate: averageRate.toFixed(4),
    };
  }
}
