import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceOverviewDto } from './dto/wallet-response.dto';
import Decimal from 'decimal.js';
import { randomBytes } from 'crypto';
import { BillingService } from '../billing/billing.service';
import { ConfigsService } from '../configs/configs.service';

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

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => BillingService))
    private readonly billingService: BillingService,
    private readonly configsService: ConfigsService,
  ) {}

  // 返佣比例统一从 ConfigsService.getReferralRates() 获取

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
      // 安全：不暴露具体余额信息
      this.logger.warn(`用户 ${userId} 购买点卡余额不足`, {
        currentBalance: usdtBalance.toString(),
        required: purchaseAmount.toString(),
      });
      throw new BadRequestException('USDT 余额不足，请先充值');
    }

    // 2. 生成订单 ID（幂等性保证）
    const orderId = `card_purchase_${userId}_${Date.now()}_${randomBytes(4).toString('hex')}`;

    // 3. 查询用户邀请关系
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: {
        referred_by_user_id: true,
      },
    });

    // 4. 使用事务：扣除 USDT + 增加点卡 + 记录日志 + 发放返佣
    const result = await this.prisma.client.$transaction(async (tx) => {
      // 4.1 扣除 USDT，增加点卡
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

      // 4.2 记录计费日志
      const billingLog = await tx.billing_logs.create({
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

      // 4.3 处理邀请返佣（统一从 ConfigsService 获取比例）
      if (user?.referred_by_user_id) {
        const rates = await this.configsService.getReferralRates('card_purchase');
        await this.processCardPurchaseReferral(
          tx,
          userId,
          user.referred_by_user_id,
          purchaseAmount,
          billingLog.id,
          rates,
        );
      }

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

  /**
   * 处理点卡购买的邀请返佣
   * 返佣比例从动态配置读取
   *
   * @param tx 事务对象
   * @param inviteeId 被邀请人（消费者）ID
   * @param referrerId 一级邀请人 ID
   * @param baseAmount 购买金额
   * @param sourceId 关联的账单 ID
   * @param rates 返佣比例配置
   */
  private async processCardPurchaseReferral(
    tx: any,
    inviteeId: string,
    referrerId: string,
    baseAmount: Decimal,
    sourceId: string,
    rates: { l1: Decimal; l2: Decimal },
  ): Promise<void> {
    // 防止自己邀请自己（理论上不应发生）
    if (inviteeId === referrerId) {
      this.logger.warn(`用户 ${inviteeId} 的邀请人是自己，跳过返佣`);
      return;
    }

    // ===== 一级返佣 =====
    const l1Commission = baseAmount.times(rates.l1).toDecimalPlaces(8);

    if (l1Commission.gt(0)) {
      // 创建一级返佣记录
      await tx.user_commissions.create({
        data: {
          referrer_id: referrerId,
          invitee_id: inviteeId,
          level: 1,
          source_type: 'card_purchase',
          source_id: sourceId,
          base_amount: baseAmount.toString(),
          commission_rate: rates.l1.toString(),
          commission_amount: l1Commission.toString(),
          status: 'settled',
          settled_at: new Date(),
        },
      });

      // 增加一级邀请人的积分余额
      await tx.wallets.upsert({
        where: { user_id: referrerId },
        create: {
          user_id: referrerId,
          usdt_balance: '0',
          card_balance: '0',
          points_balance: l1Commission.toString(),
        },
        update: {
          points_balance: {
            increment: l1Commission.toNumber(),
          },
          updated_at: new Date(),
        },
      });

      this.logger.log(
        `点卡一级返佣：用户 ${inviteeId} 购买点卡 ${baseAmount} USDT，邀请人 ${referrerId} 获得 ${l1Commission} 积分 (${rates.l1.times(100)}%)`,
      );

      // ===== 二级返佣 =====
      // 查询一级邀请人的邀请人（二级）
      const l1Referrer = await tx.users.findUnique({
        where: { id: referrerId },
        select: { referred_by_user_id: true },
      });

      if (l1Referrer?.referred_by_user_id) {
        const l2ReferrerId = l1Referrer.referred_by_user_id;

        // 防止循环引用
        if (l2ReferrerId !== inviteeId && l2ReferrerId !== referrerId) {
          const l2Commission = baseAmount.times(rates.l2).toDecimalPlaces(8);

          if (l2Commission.gt(0)) {
            // 创建二级返佣记录
            await tx.user_commissions.create({
              data: {
                referrer_id: l2ReferrerId,
                invitee_id: inviteeId,
                level: 2,
                source_type: 'card_purchase',
                source_id: sourceId,
                base_amount: baseAmount.toString(),
                commission_rate: rates.l2.toString(),
                commission_amount: l2Commission.toString(),
                status: 'settled',
                settled_at: new Date(),
              },
            });

            // 增加二级邀请人的积分余额
            await tx.wallets.upsert({
              where: { user_id: l2ReferrerId },
              create: {
                user_id: l2ReferrerId,
                usdt_balance: '0',
                card_balance: '0',
                points_balance: l2Commission.toString(),
              },
              update: {
                points_balance: {
                  increment: l2Commission.toNumber(),
                },
                updated_at: new Date(),
              },
            });

            this.logger.log(
              `点卡二级返佣：用户 ${inviteeId} 购买点卡 ${baseAmount} USDT，二级邀请人 ${l2ReferrerId} 获得 ${l2Commission} 积分 (${rates.l2.times(100)}%)`,
            );
          }
        }
      }
    }
  }
}
