import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceOverviewDto } from './dto/wallet-response.dto';
import Decimal from 'decimal.js';
import { randomBytes } from 'crypto';

/**
 * 钱包服务
 * 处理资金相关业务逻辑
 *
 * 注意事项：
 * - 所有金额计算必须使用 decimal.js，禁止使用 JavaScript 原生运算
 * - 所有资金操作必须使用事务
 * - 所有计费操作必须实现幂等性（unique_order_id）
 */
@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 根据用户 ID 查找钱包
   * @param userId 用户 ID
   * @returns 钱包信息
   * @throws NotFoundException 如果钱包不存在
   */
  async findByUserId(userId: string) {
    const wallet = await this.prisma.client.wallets.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new NotFoundException('钱包不存在');
    }

    return wallet;
  }

  /**
   * 获取用户余额概览
   * @param userId 用户 ID
   * @returns 余额概览（USDT、积分、Token）
   */
  async getBalance(userId: string): Promise<BalanceOverviewDto> {
    const wallet = await this.findByUserId(userId);

    // 使用 Decimal.js 计算总额（避免浮点数精度问题）
    const usdtTotal = new Decimal(wallet.usdt_balance).plus(
      wallet.usdt_frozen,
    );
    const pointsTotal = new Decimal(wallet.points_balance).plus(
      wallet.points_frozen,
    );
    const tokenTotal = new Decimal(wallet.token_balance)
      .plus(wallet.token_locked)
      .plus(wallet.token_vesting);

    return {
      usdt: {
        available: wallet.usdt_balance.toString(),
        frozen: wallet.usdt_frozen.toString(),
        total: usdtTotal.toString(),
      },
      card: {
        available: (wallet.card_balance || '0').toString(),
      },
      points: {
        available: wallet.points_balance.toString(),
        frozen: wallet.points_frozen.toString(),
        total: pointsTotal.toString(),
      },
      token: {
        available: wallet.token_balance.toString(),
        locked: wallet.token_locked.toString(),
        vesting: wallet.token_vesting.toString(),
        total: tokenTotal.toString(),
      },
    };
  }

  /**
   * 创建钱包（仅在用户注册时调用）
   * @param userId 用户 ID
   * @returns 新创建的钱包
   */
  async createWallet(userId: string) {
    return this.prisma.client.wallets.create({
      data: {
        user_id: userId,
      },
    });
  }

  /**
   * 增加 USDT 余额（充值审核通过时调用）
   * @param userId 用户 ID
   * @param amount 金额（string 格式）
   * @param tx 可选事务对象
   */
  async increaseBalance(
    userId: string,
    amount: string,
    tx?: any,
  ): Promise<void> {
    const prisma = tx || this.prisma.client;

    const amountDecimal = new Decimal(amount);
    if (amountDecimal.lte(0)) {
      throw new Error('金额必须大于 0');
    }

    await prisma.wallets.update({
      where: { user_id: userId },
      data: {
        usdt_balance: {
          increment: amountDecimal.toNumber(),
        },
      },
    });
  }

  /**
   * 冻结 USDT 余额（提现申请时调用）
   * @param userId 用户 ID
   * @param amount 冻结金额
   * @param tx 可选事务对象
   * @throws Error 如果余额不足
   */
  async freezeBalance(
    userId: string,
    amount: string,
    tx?: any,
  ): Promise<void> {
    const prisma = tx || this.prisma.client;

    const wallet = await prisma.wallets.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new NotFoundException('钱包不存在');
    }

    const amountDecimal = new Decimal(amount);
    const availableBalance = new Decimal(wallet.usdt_balance);

    if (availableBalance.lt(amountDecimal)) {
      throw new Error('余额不足');
    }

    // 从可用余额扣除，增加冻结余额
    await prisma.wallets.update({
      where: { user_id: userId },
      data: {
        usdt_balance: {
          decrement: amountDecimal.toNumber(),
        },
        usdt_frozen: {
          increment: amountDecimal.toNumber(),
        },
      },
    });
  }

  /**
   * 解冻并扣除 USDT 余额（提现审核通过时调用）
   * @param userId 用户 ID
   * @param amount 金额
   * @param tx 可选事务对象
   */
  async unfreezeAndDeduct(
    userId: string,
    amount: string,
    tx?: any,
  ): Promise<void> {
    const prisma = tx || this.prisma.client;

    const amountDecimal = new Decimal(amount);

    await prisma.wallets.update({
      where: { user_id: userId },
      data: {
        usdt_frozen: {
          decrement: amountDecimal.toNumber(),
        },
      },
    });
  }

  /**
   * 解冻余额（提现被拒绝时调用）
   * @param userId 用户 ID
   * @param amount 金额
   * @param tx 可选事务对象
   */
  async unfreezeBalance(
    userId: string,
    amount: string,
    tx?: any,
  ): Promise<void> {
    const prisma = tx || this.prisma.client;

    const amountDecimal = new Decimal(amount);

    // 从冻结余额扣除，增加可用余额
    await prisma.wallets.update({
      where: { user_id: userId },
      data: {
        usdt_frozen: {
          decrement: amountDecimal.toNumber(),
        },
        usdt_balance: {
          increment: amountDecimal.toNumber(),
        },
      },
    });
  }

  /**
   * 购买点卡（USDT → 点卡）
   * 用户使用 USDT 购买点卡，点卡用于支付燃油费
   *
   * @param userId 用户 ID
   * @param amount 购买金额（USDT）
   * @returns 购买结果
   */
  async purchaseCard(userId: string, amount: string): Promise<{
    success: boolean;
    cardBalance: string;
    usdtBalance: string;
    orderId: string;
  }> {
    const purchaseAmount = new Decimal(amount);

    if (purchaseAmount.lte(0)) {
      throw new BadRequestException('购买金额必须大于 0');
    }

    // 1. 检查 USDT 余额
    const wallet = await this.findByUserId(userId);
    const usdtBalance = new Decimal(wallet.usdt_balance);

    if (usdtBalance.lt(purchaseAmount)) {
      throw new BadRequestException(
        `USDT 余额不足，当前余额: ${usdtBalance}, 需要: ${purchaseAmount}`,
      );
    }

    // 2. 生成订单 ID（幂等性保证）
    const orderId = `card_purchase_${userId}_${Date.now()}_${randomBytes(4).toString('hex')}`;

    // 3. 使用事务：扣除 USDT + 增加点卡 + 记录日志
    const result = await this.prisma.client.$transaction(async (tx) => {
      // 3.1 扣除 USDT，增加点卡
      const newUsdtBalance = usdtBalance.minus(purchaseAmount);
      const currentCardBalance = new Decimal(wallet.card_balance || '0');
      const newCardBalance = currentCardBalance.plus(purchaseAmount);

      await tx.wallets.update({
        where: { user_id: userId },
        data: {
          usdt_balance: newUsdtBalance.toString(),
          card_balance: newCardBalance.toString(),
          updated_at: new Date(),
        },
      });

      // 3.2 记录计费日志
      await tx.billing_logs.create({
        data: {
          user_id: userId,
          unique_order_id: orderId,
          billing_type: 'card_purchase',
          amount: purchaseAmount.toString(),
          currency: 'USDT',
          description: `购买点卡 ${purchaseAmount} USDT`,
          status: 'completed',
        },
      });

      return {
        cardBalance: newCardBalance.toString(),
        usdtBalance: newUsdtBalance.toString(),
      };
    });

    this.logger.log(
      `用户 ${userId} 购买点卡成功: ${purchaseAmount} USDT, 点卡余额: ${result.cardBalance}`,
    );

    return {
      success: true,
      cardBalance: result.cardBalance,
      usdtBalance: result.usdtBalance,
      orderId,
    };
  }
}
