import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import Decimal from 'decimal.js';
import {
  ExchangeResponseDto,
  TokenOrderResponseDto,
} from './dto/token-order-response.dto';
import {
  VestingProgressDto,
  VestingOrderDto,
} from './dto/vesting-progress.dto';

/**
 * 链上提现手续费（固定）
 */
const ONCHAIN_WITHDRAW_FEE = new Decimal('5'); // 5 QFI

/**
 * 最小提现金额
 */
const MIN_WITHDRAW_AMOUNT = new Decimal('10'); // 10 QFI

/**
 * 代币服务
 * 处理积分兑换代币、线性释放、销毁等业务逻辑
 *
 * 兑换率：1000 积分 = 1 $QFI
 *
 * 兑换模式：
 * - standard（标准模式）：20% 立即到账 + 80% 线性 90 天释放
 * - fast（急速模式）：50% 立即到账 + 50% 销毁
 *
 * 注意事项：
 * - 所有代币计算必须使用 decimal.js
 * - 兑换操作必须使用事务
 * - 释放进度记录到 token_orders.tokens_released
 * - 销毁记录到 token_burns 表
 */
@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);
  private readonly EXCHANGE_RATE = new Decimal(1000); // 1000 积分 = 1 QFI
  private readonly STANDARD_IMMEDIATE_PERCENT = new Decimal(0.2); // 标准模式 20% 立即
  private readonly STANDARD_VESTING_DAYS = 90; // 标准模式释放 90 天
  private readonly FAST_IMMEDIATE_PERCENT = new Decimal(0.5); // 急速模式 50% 立即
  private readonly FAST_BURN_PERCENT = new Decimal(0.5); // 急速模式 50% 销毁

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 积分兑换代币
   * @param userId 用户 ID
   * @param points 兑换积分数量
   * @param mode 兑换模式 standard | fast
   * @returns 兑换结果
   */
  async exchange(
    userId: string,
    points: number,
    mode: 'standard' | 'fast',
  ): Promise<ExchangeResponseDto> {
    return this.prisma.client.$transaction(async (tx) => {
      // 1. 检查钱包是否存在
      const wallet = await tx.wallets.findUnique({
        where: { user_id: userId },
      });

      if (!wallet) {
        throw new NotFoundException('钱包不存在');
      }

      // 2. 检查积分余额
      const pointsDecimal = new Decimal(points);
      const availablePoints = new Decimal(wallet.points_balance);

      if (availablePoints.lt(pointsDecimal)) {
        throw new BadRequestException(
          `积分余额不足，当前可用: ${availablePoints.toString()}`,
        );
      }

      // 3. 计算代币数量（1000 积分 = 1 QFI）
      const tokensTotal = pointsDecimal.div(this.EXCHANGE_RATE);

      // 4. 根据模式计算立即到账、待释放、销毁数量
      let tokensImmediate: Decimal;
      let tokensPending: Decimal;
      let tokensBurned: Decimal;
      let vestingEndAt: Date | null = null;

      if (mode === 'standard') {
        // 标准模式：20% 立即 + 80% 待释放
        tokensImmediate = tokensTotal.mul(this.STANDARD_IMMEDIATE_PERCENT);
        tokensPending = tokensTotal.mul(new Decimal(0.8));
        tokensBurned = new Decimal(0);

        // 计算释放结束日期（90 天后）
        vestingEndAt = new Date();
        vestingEndAt.setDate(vestingEndAt.getDate() + this.STANDARD_VESTING_DAYS);
      } else {
        // 急速模式：50% 立即 + 50% 销毁
        tokensImmediate = tokensTotal.mul(this.FAST_IMMEDIATE_PERCENT);
        tokensPending = new Decimal(0);
        tokensBurned = tokensTotal.mul(this.FAST_BURN_PERCENT);
      }

      // 5. 扣除积分
      await tx.wallets.update({
        where: { user_id: userId },
        data: {
          points_balance: {
            decrement: pointsDecimal.toNumber(),
          },
        },
      });

      // 6. 增加立即到账代币
      await tx.wallets.update({
        where: { user_id: userId },
        data: {
          token_balance: {
            increment: tokensImmediate.toNumber(),
          },
          token_vesting: {
            increment: tokensPending.toNumber(),
          },
        },
      });

      // 7. 创建兑换订单
      const order = await tx.token_orders.create({
        data: {
          user_id: userId,
          points_spent: pointsDecimal.toString(),
          tokens_total: tokensTotal.toString(),
          exchange_rate: this.EXCHANGE_RATE.toString(),
          vesting_mode: mode,
          tokens_released: tokensImmediate.toString(),
          tokens_pending: tokensPending.toString(),
          tokens_burned: tokensBurned.toString(),
          vesting_start_at: new Date(),
          vesting_end_at: vestingEndAt,
          last_release_at: mode === 'standard' ? new Date() : null,
          status: mode === 'standard' ? 'vesting' : 'completed',
        },
      });

      // 8. 如果是急速模式，记录销毁
      if (mode === 'fast' && tokensBurned.gt(0)) {
        await tx.token_burns.create({
          data: {
            source_type: 'fast_exchange',
            source_id: order.id,
            amount: tokensBurned.toString(),
          },
        });
      }

      this.logger.log(
        `用户 ${userId} 兑换代币成功，模式: ${mode}, 积分: ${points}, 代币: ${tokensTotal.toString()}`,
      );

      return {
        orderId: order.id,
        tokensReceived: tokensImmediate.toString(),
        tokensPending: tokensPending.toString(),
        tokensBurned: tokensBurned.toString(),
        message:
          mode === 'standard'
            ? `已获得 ${tokensImmediate.toString()} $QFI，剩余 ${tokensPending.toString()} $QFI 将在 90 天内线性释放`
            : `已获得 ${tokensImmediate.toString()} $QFI，${tokensBurned.toString()} $QFI 已销毁`,
      };
    });
  }

  /**
   * 处理每日代币释放（定时任务：每天凌晨 1 点执行）
   * 标准模式：80% 代币在 90 天内线性释放
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async processVesting() {
    this.logger.log('开始处理每日代币释放...');

    try {
      // 查询所有待释放的订单（标准模式 + 状态为 vesting）
      const vestingOrders = await this.prisma.client.token_orders.findMany({
        where: {
          vesting_mode: 'standard',
          status: 'vesting',
          tokens_pending: {
            gt: 0,
          },
        },
      });

      this.logger.log(`找到 ${vestingOrders.length} 个待释放订单`);

      // 逐个处理释放
      for (const order of vestingOrders) {
        await this.releaseTokensForOrder(order.id);
      }

      this.logger.log('每日代币释放处理完成');
    } catch (error) {
      this.logger.error('处理每日代币释放失败', error.stack);
    }
  }

  /**
   * 为单个订单释放代币
   * @param orderId 订单 ID
   */
  private async releaseTokensForOrder(orderId: string) {
    await this.prisma.client.$transaction(async (tx) => {
      const order = await tx.token_orders.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`订单 ${orderId} 不存在，跳过释放`);
        return;
      }

      const tokensPending = new Decimal(order.tokens_pending);
      if (tokensPending.lte(0)) {
        // 没有待释放代币，标记为已完成
        await tx.token_orders.update({
          where: { id: orderId },
          data: { status: 'completed' },
        });
        return;
      }

      // 计算每日释放量：80% 代币 / 90 天
      const tokensTotal = new Decimal(order.tokens_total);
      const vestingAmount = tokensTotal.mul(new Decimal(0.8)); // 80% 待释放
      const dailyRelease = vestingAmount.div(this.STANDARD_VESTING_DAYS);

      // 如果待释放余额小于每日释放量，则释放全部
      const releaseAmount = Decimal.min(dailyRelease, tokensPending);

      // 更新钱包：从 token_vesting 转到 token_balance
      await tx.wallets.update({
        where: { user_id: order.user_id },
        data: {
          token_vesting: {
            decrement: releaseAmount.toNumber(),
          },
          token_balance: {
            increment: releaseAmount.toNumber(),
          },
        },
      });

      // 更新订单释放进度
      const newTokensReleased = new Decimal(order.tokens_released).plus(
        releaseAmount,
      );
      const newTokensPending = tokensPending.minus(releaseAmount);

      await tx.token_orders.update({
        where: { id: orderId },
        data: {
          tokens_released: newTokensReleased.toString(),
          tokens_pending: newTokensPending.toString(),
          last_release_at: new Date(),
          status: newTokensPending.lte(0) ? 'completed' : 'vesting',
        },
      });

      this.logger.log(
        `订单 ${orderId} 释放代币: ${releaseAmount.toString()}, 剩余待释放: ${newTokensPending.toString()}`,
      );
    });
  }

  /**
   * 查询用户释放进度
   * @param userId 用户 ID
   * @returns 释放进度详情
   */
  async getVestingProgress(userId: string): Promise<VestingProgressDto> {
    // 查询用户所有释放中的订单
    const vestingOrders = await this.prisma.client.token_orders.findMany({
      where: {
        user_id: userId,
        vesting_mode: 'standard',
        status: 'vesting',
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // 查询钱包待释放余额
    const wallet = await this.prisma.client.wallets.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new NotFoundException('钱包不存在');
    }

    const totalVesting = new Decimal(wallet.token_vesting);
    let totalReleased = new Decimal(0);
    let totalPending = new Decimal(0);

    // 计算下次释放时间和数量
    let nextReleaseDate: Date | null = null;
    let nextReleaseAmount = new Decimal(0);

    const vestingOrderDtos: VestingOrderDto[] = vestingOrders.map((order) => {
      const tokensTotal = new Decimal(order.tokens_total);
      const tokensReleased = new Decimal(order.tokens_released);
      const tokensPending = new Decimal(order.tokens_pending);

      totalReleased = totalReleased.plus(tokensReleased);
      totalPending = totalPending.plus(tokensPending);

      // 计算进度百分比
      const progress = tokensTotal.gt(0)
        ? tokensReleased.div(tokensTotal).mul(100).toNumber()
        : 0;

      // 计算剩余天数
      let daysRemaining = 0;
      if (order.vesting_end_at) {
        const now = new Date();
        const endDate = new Date(order.vesting_end_at);
        daysRemaining = Math.max(
          0,
          Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        );
      }

      // 计算该订单的每日释放量
      const vestingAmount = tokensTotal.mul(new Decimal(0.8));
      const dailyRelease = vestingAmount.div(this.STANDARD_VESTING_DAYS);
      nextReleaseAmount = nextReleaseAmount.plus(
        Decimal.min(dailyRelease, tokensPending),
      );

      return {
        orderId: order.id,
        tokensTotal: tokensTotal.toString(),
        tokensReleased: tokensReleased.toString(),
        tokensPending: tokensPending.toString(),
        vestingMode: order.vesting_mode as 'standard' | 'fast',
        vestingStartAt: order.vesting_start_at,
        vestingEndAt: order.vesting_end_at,
        lastReleaseAt: order.last_release_at,
        progress: Math.round(progress * 100) / 100,
        daysRemaining,
      };
    });

    // 下次释放时间：明天凌晨 1 点
    if (vestingOrders.length > 0) {
      nextReleaseDate = new Date();
      nextReleaseDate.setDate(nextReleaseDate.getDate() + 1);
      nextReleaseDate.setHours(1, 0, 0, 0);
    }

    return {
      totalVesting: totalVesting.toString(),
      released: totalReleased.toString(),
      pending: totalPending.toString(),
      nextReleaseAmount: nextReleaseAmount.toString(),
      nextReleaseDate,
      vestingOrders: vestingOrderDtos,
    };
  }

  /**
   * 查询用户兑换订单列表
   * @param userId 用户 ID
   * @returns 订单列表
   */
  async getOrders(userId: string): Promise<TokenOrderResponseDto[]> {
    const orders = await this.prisma.client.token_orders.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    return orders.map((order) => ({
      id: order.id,
      userId: order.user_id,
      pointsSpent: order.points_spent.toString(),
      tokensTotal: order.tokens_total.toString(),
      exchangeRate: order.exchange_rate.toString(),
      vestingMode: order.vesting_mode as 'standard' | 'fast',
      tokensReleased: order.tokens_released.toString(),
      tokensPending: order.tokens_pending.toString(),
      tokensBurned: order.tokens_burned.toString(),
      vestingStartAt: order.vesting_start_at,
      vestingEndAt: order.vesting_end_at,
      lastReleaseAt: order.last_release_at,
      status: order.status,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    }));
  }

  /**
   * 查询用户代币余额（包含待释放）
   * @param userId 用户 ID
   */
  async getBalance(userId: string) {
    const wallet = await this.prisma.client.wallets.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new NotFoundException('钱包不存在');
    }

    const tokenTotal = new Decimal(wallet.token_balance)
      .plus(wallet.token_locked)
      .plus(wallet.token_vesting);

    return {
      available: wallet.token_balance.toString(),
      locked: wallet.token_locked.toString(),
      vesting: wallet.token_vesting.toString(),
      total: tokenTotal.toString(),
    };
  }

  // ===================== 链上功能 =====================

  /**
   * 链上提现（将平台 QFI 提现到 BSC 链上钱包）
   */
  async withdrawOnchain(userId: string, amount: string, toAddress: string) {
    const amountDecimal = new Decimal(amount);

    // 校验最小金额
    if (amountDecimal.lt(MIN_WITHDRAW_AMOUNT)) {
      throw new BadRequestException(`最小提现金额为 ${MIN_WITHDRAW_AMOUNT.toString()} QFI`);
    }

    // 获取钱包余额
    const wallet = await this.prisma.client.wallets.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new BadRequestException('钱包不存在');
    }

    const balance = new Decimal(wallet.token_balance || '0');
    const totalNeeded = amountDecimal.plus(ONCHAIN_WITHDRAW_FEE);

    if (balance.lt(totalNeeded)) {
      throw new BadRequestException(
        `余额不足，需要 ${totalNeeded.toFixed(8)} QFI（含手续费 ${ONCHAIN_WITHDRAW_FEE.toString()} QFI）`,
      );
    }

    // 创建提现记录并扣除余额
    const [withdrawal] = await this.prisma.client.$transaction([
      // 创建提现记录
      this.prisma.client.token_onchain_withdrawals.create({
        data: {
          user_id: userId,
          amount: amountDecimal.toFixed(8),
          fee: ONCHAIN_WITHDRAW_FEE.toFixed(8),
          to_address: toAddress,
          status: 'pending',
        },
      }),
      // 扣除余额
      this.prisma.client.wallets.update({
        where: { user_id: userId },
        data: {
          token_balance: balance.minus(totalNeeded).toNumber(),
        },
      }),
    ]);

    this.logger.log(`用户 ${userId} 发起链上提现 ${amountDecimal.toFixed(8)} QFI 到 ${toAddress}`);

    return {
      id: withdrawal.id,
      amount: withdrawal.amount.toString(),
      fee: withdrawal.fee.toString(),
      netAmount: amountDecimal.toString(),
      toAddress: withdrawal.to_address,
      status: withdrawal.status,
    };
  }

  /**
   * 获取用户提现记录
   */
  async getWithdrawals(userId: string, limit: number | string = 20) {
    const takeLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    const withdrawals = await this.prisma.client.token_onchain_withdrawals.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: takeLimit || 20,
    });

    return withdrawals.map((w) => ({
      id: w.id,
      amount: w.amount.toString(),
      fee: w.fee.toString(),
      toAddress: w.to_address,
      txHash: w.tx_hash,
      status: w.status,
      createdAt: w.created_at.toISOString(),
    }));
  }

  /**
   * 记录回购销毁（仅管理员）
   */
  async recordBuyback(usdtSpent: string, qfiBought: string, price: string, txHash: string) {
    const record = await this.prisma.client.token_buybacks.create({
      data: {
        usdt_spent: usdtSpent,
        qfi_bought: qfiBought,
        price: price,
        tx_hash: txHash,
      },
    });

    this.logger.log(`记录回购销毁: ${qfiBought} QFI, 花费 ${usdtSpent} USDT`);

    return {
      id: record.id,
      usdtSpent: record.usdt_spent.toString(),
      qfiBought: record.qfi_bought.toString(),
      price: record.price.toString(),
      txHash: record.tx_hash,
      boughtAt: record.bought_at.toISOString(),
    };
  }

  /**
   * 获取代币统计
   */
  async getTokenStats() {
    // 获取本月回购数据
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const buybacks = await this.prisma.client.token_buybacks.findMany({
      where: {
        bought_at: { gte: startOfMonth },
      },
    });

    let monthlyBuybackUsdt = new Decimal(0);
    let monthlyBurnedQfi = new Decimal(0);

    buybacks.forEach((b) => {
      monthlyBuybackUsdt = monthlyBuybackUsdt.plus(b.usdt_spent.toString());
      monthlyBurnedQfi = monthlyBurnedQfi.plus(b.qfi_bought.toString());
    });

    // 获取总销毁量
    const allBuybacks = await this.prisma.client.token_buybacks.aggregate({
      _sum: {
        qfi_bought: true,
      },
    });

    const totalBurned = new Decimal(allBuybacks._sum.qfi_bought?.toString() || '0');

    // 代币参数（与合约一致）
    const totalSupply = new Decimal('100000000'); // 1亿
    const circulatingSupply = totalSupply.minus(totalBurned);

    // 计算当前价格（基于最近一次回购）
    const lastBuyback = await this.prisma.client.token_buybacks.findFirst({
      orderBy: { bought_at: 'desc' },
    });
    const currentPrice = lastBuyback?.price.toString() || '0.20'; // 默认 0.20 USDT

    return {
      totalSupply: totalSupply.toFixed(8),
      circulatingSupply: circulatingSupply.toFixed(8),
      totalBurned: totalBurned.toFixed(8),
      monthlyBuybackUsdt: monthlyBuybackUsdt.toFixed(8),
      monthlyBurnedQfi: monthlyBurnedQfi.toFixed(8),
      currentPrice,
    };
  }

  /**
   * 获取回购历史
   */
  async getBuybackHistory(limit: number | string = 20) {
    const takeLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    const buybacks = await this.prisma.client.token_buybacks.findMany({
      orderBy: { bought_at: 'desc' },
      take: takeLimit || 20,
    });

    return buybacks.map((b) => ({
      id: b.id,
      usdtSpent: b.usdt_spent.toString(),
      qfiBought: b.qfi_bought.toString(),
      price: b.price.toString(),
      txHash: b.tx_hash,
      boughtAt: b.bought_at.toISOString(),
    }));
  }

  /**
   * 处理提现（管理员标记为已完成）
   */
  async processWithdrawal(withdrawalId: string, txHash: string) {
    const withdrawal = await this.prisma.client.token_onchain_withdrawals.update({
      where: { id: withdrawalId },
      data: {
        tx_hash: txHash,
        status: 'completed',
        updated_at: new Date(),
      },
    });

    this.logger.log(`提现 ${withdrawalId} 处理完成，txHash: ${txHash}`);

    return {
      id: withdrawal.id,
      status: withdrawal.status,
      txHash: withdrawal.tx_hash,
    };
  }

  /**
   * 获取待处理提现（管理员）
   */
  async getPendingWithdrawals() {
    return this.prisma.client.token_onchain_withdrawals.findMany({
      where: { status: 'pending' },
      orderBy: { created_at: 'asc' },
      include: {
        users: {
          select: { email: true },
        },
      },
    });
  }
}
