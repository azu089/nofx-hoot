import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsBalanceDto, PointsHistoryDto } from './dto/points-response.dto';
import Decimal from 'decimal.js';
import { randomBytes } from 'crypto';

/**
 * 积分服务
 * 处理积分获取、抵扣、查询等业务逻辑
 *
 * 积分规则：
 * - 交易挖矿：每 100 USDT 交易量 = 1 积分
 * - VIP 加成：VIP1 x1.2, VIP2 x1.5, VIP3 x2.0
 *
 * 注意事项：
 * - 所有积分计算必须使用 decimal.js，禁止使用 JavaScript 原生运算
 * - 所有积分操作必须使用事务
 * - 所有操作必须实现幂等性（unique_order_id）
 */
@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  // 积分获取基础比例：每 100 USDT 交易量 = 1 积分
  private readonly POINTS_PER_100_USDT = new Decimal('1');
  private readonly TRADE_VOLUME_UNIT = new Decimal('100');

  // VIP 等级加成
  private readonly VIP_MULTIPLIERS: Record<number, Decimal> = {
    0: new Decimal('1.0'), // 普通用户 1.0x
    1: new Decimal('1.2'), // VIP1 1.2x
    2: new Decimal('1.5'), // VIP2 1.5x
    3: new Decimal('2.0'), // VIP3 2.0x
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 生成唯一订单 ID（幂等性保证）
   * 格式: {type}_{user_id}_{timestamp}_{nonce}
   */
  private generateOrderId(type: string, userId: string): string {
    const timestamp = Date.now();
    const nonce = randomBytes(4).toString('hex');
    return `${type}_${userId}_${timestamp}_${nonce}`;
  }

  /**
   * 根据 VIP 等级获取加成倍数
   * @param vipLevel VIP 等级 (0-3)
   * @returns 加成倍数
   */
  private getVipMultiplier(vipLevel: number): Decimal {
    return this.VIP_MULTIPLIERS[vipLevel] || this.VIP_MULTIPLIERS[0];
  }

  /**
   * 从交易中获取积分（交易挖矿）
   * @param userId 用户 ID
   * @param tradeVolume 交易量 (USDT)
   * @param tradeId 交易 ID（用于关联）
   * @param tx 可选事务对象
   * @returns 获得的积分数量
   */
  async earnFromTrade(
    userId: string,
    tradeVolume: string,
    tradeId: string,
    tx?: any,
  ): Promise<string> {
    const prisma = tx || this.prisma.client;

    // 1. 查询用户 VIP 等级
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { vip_level: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 2. 计算基础积分 = 交易量 / 100
    const volume = new Decimal(tradeVolume);
    if (volume.lte(0)) {
      throw new BadRequestException('交易量必须大于 0');
    }

    const basePoints = volume.dividedBy(this.TRADE_VOLUME_UNIT).times(this.POINTS_PER_100_USDT);

    // 3. 应用 VIP 加成
    const vipMultiplier = this.getVipMultiplier(user.vip_level);
    const earnedPoints = basePoints.times(vipMultiplier).toDecimalPlaces(8);

    this.logger.log(
      `用户 ${userId} (VIP${user.vip_level}) 交易量 ${volume} USDT，基础积分 ${basePoints}，加成后 ${earnedPoints}`,
    );

    // 4. 检查是否已经处理过（幂等性）
    const existingLog = await prisma.billing_logs.findFirst({
      where: {
        user_id: userId,
        reference_type: 'trade_history',
        reference_id: tradeId,
        billing_type: 'points_earn',
      },
    });

    if (existingLog) {
      this.logger.warn(`交易 ${tradeId} 已经获取过积分，跳过`);
      return '0';
    }

    // 5. 使用事务：更新钱包 + 记录日志
    const orderId = this.generateOrderId('points_earn', userId);

    await prisma.$transaction(async (innerTx: any) => {
      // 5.1 更新钱包积分余额
      await innerTx.wallets.update({
        where: { user_id: userId },
        data: {
          points_balance: {
            increment: earnedPoints.toNumber(),
          },
          updated_at: new Date(),
        },
      });

      // 5.2 创建积分获取日志
      await innerTx.billing_logs.create({
        data: {
          user_id: userId,
          unique_order_id: orderId,
          billing_type: 'points_earn',
          amount: earnedPoints.toString(),
          currency: 'POINTS',
          reference_type: 'trade_history',
          reference_id: tradeId,
          description: `交易挖矿：${volume} USDT x ${vipMultiplier} (VIP${user.vip_level})`,
          status: 'completed',
        },
      });
    });

    this.logger.log(`用户 ${userId} 从交易 ${tradeId} 获得 ${earnedPoints} 积分`);

    return earnedPoints.toString();
  }

  /**
   * 抵扣积分用于订阅（管理员调用）
   * @param userId 用户 ID
   * @param points 抵扣积分数量
   * @param description 抵扣描述
   * @param tx 可选事务对象
   * @returns 抵扣的积分数量
   */
  async deductForSubscription(
    userId: string,
    points: string,
    description: string,
    tx?: any,
  ): Promise<string> {
    const prisma = tx || this.prisma.client;

    const deductPoints = new Decimal(points);
    if (deductPoints.lte(0)) {
      throw new BadRequestException('抵扣积分必须大于 0');
    }

    // 1. 查询用户钱包
    const wallet = await prisma.wallets.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new NotFoundException('钱包不存在');
    }

    // 2. 检查积分余额是否足够
    const availablePoints = new Decimal(wallet.points_balance);
    if (availablePoints.lt(deductPoints)) {
      throw new BadRequestException(
        `积分不足，可用 ${availablePoints}，需要 ${deductPoints}`,
      );
    }

    // 3. 使用事务：扣除积分 + 记录日志
    const orderId = this.generateOrderId('points_deduct', userId);

    await prisma.$transaction(async (innerTx: any) => {
      // 3.1 扣除钱包积分余额
      const newBalance = availablePoints.minus(deductPoints);
      await innerTx.wallets.update({
        where: { user_id: userId },
        data: {
          points_balance: newBalance.toString(),
          updated_at: new Date(),
        },
      });

      // 3.2 创建积分扣除日志
      await innerTx.billing_logs.create({
        data: {
          user_id: userId,
          unique_order_id: orderId,
          billing_type: 'points_deduct',
          amount: `-${deductPoints.toString()}`, // 负数表示扣除
          currency: 'POINTS',
          description,
          status: 'completed',
        },
      });
    });

    this.logger.log(`用户 ${userId} 抵扣 ${deductPoints} 积分用于 ${description}`);

    return deductPoints.toString();
  }

  /**
   * 查询用户积分余额
   * @param userId 用户 ID
   * @returns 积分余额信息
   */
  async getBalance(userId: string): Promise<PointsBalanceDto> {
    const wallet = await this.prisma.client.wallets.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new NotFoundException('钱包不存在');
    }

    // 使用 Decimal.js 计算总额
    const available = new Decimal(wallet.points_balance);
    const frozen = new Decimal(wallet.points_frozen);
    const total = available.plus(frozen);

    return {
      available: available.toString(),
      frozen: frozen.toString(),
      total: total.toString(),
    };
  }

  /**
   * 查询用户积分流水
   * @param userId 用户 ID
   * @param limit 限制条数（默认 50）
   * @returns 积分流水列表
   */
  async getHistory(
    userId: string,
    limit: number = 50,
  ): Promise<PointsHistoryDto[]> {
    const logs = await this.prisma.client.billing_logs.findMany({
      where: {
        user_id: userId,
        currency: 'POINTS',
        billing_type: {
          in: ['points_earn', 'points_deduct'],
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      userId: log.user_id,
      uniqueOrderId: log.unique_order_id,
      billingType: log.billing_type,
      amount: log.amount.toString(),
      referenceType: log.reference_type,
      referenceId: log.reference_id,
      description: log.description,
      status: log.status,
      createdAt: log.created_at,
    }));
  }
}
