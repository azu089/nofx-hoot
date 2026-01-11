import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { GasFeeResultDto, GasFeeDetailDto, TodayPnLDto, PnLCurveResponseDto, PnLCurvePointDto } from './dto/gas-fee.dto';
import { BillingLogResponseDto } from './dto/billing-log-response.dto';
import Decimal from 'decimal.js';
import { randomBytes } from 'crypto';

/**
 * 计费服务
 * 处理计费相关业务逻辑
 *
 * 注意事项：
 * - 所有计费操作必须幂等（使用 unique_order_id）
 * - 订单 ID 格式：{type}_{user_id}_{timestamp}_{nonce}
 * - 所有金额计算使用 decimal.js
 * - 必须使用事务
 * - 必须记录审计日志
 *
 * 积分联动：
 * - 订阅扣费时优先使用积分抵扣
 * - 抵扣比例：1 积分 = 1 USDT
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  // 燃油费抽成比例 (20%)
  private readonly GAS_FEE_RATE = new Decimal('0.20');

  // 积分抵扣比例：1 积分 = 1 USDT
  private readonly POINTS_TO_USDT_RATE = new Decimal('1');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PointsService))
    private readonly pointsService: PointsService,
  ) {}

  /**
   * 生成唯一订单 ID（幂等性保证）
   * 格式: {type}_{trade_id}_{timestamp}_{nonce}
   */
  private generateOrderId(type: string, referenceId: string): string {
    const timestamp = Date.now();
    const nonce = randomBytes(4).toString('hex');
    return `${type}_${referenceId}_${timestamp}_${nonce}`;
  }

  /**
   * 计算并扣除燃油费
   * 处理盈利交易的 20% 抽成
   *
   * 规则（白皮书 1.2）：燃油费从"预充值点卡"扣除
   * - 用户需先用 USDT 购买点卡（POST /api/wallets/purchase-card）
   * - 燃油费从 card_balance 扣除
   * - 点卡不足时记为欠费 (pending)
   *
   * @param tradeId 指定交易 ID（可选）
   * @param instanceId 指定实例 ID（可选）
   * @returns 处理结果
   */
  async calculateGasFee(tradeId?: string, instanceId?: string): Promise<GasFeeResultDto> {
    this.logger.log('开始计算燃油费抽成（从点卡扣除）');

    // 1. 查询需要处理的交易（盈利 + 未抽成）
    const where: any = {
      status: 'closed', // 只处理已平仓交易
      pnl: { gt: 0 }, // 只处理盈利交易
      gas_fee: { equals: 0 }, // 未抽成（gas_fee = 0）
    };

    if (tradeId) {
      where.id = tradeId;
    }

    if (instanceId) {
      where.instance_id = instanceId;
    }

    const trades = await this.prisma.client.trade_history.findMany({
      where,
      include: {
        users: {
          include: {
            wallets: true,
            referrer: {
              select: {
                id: true,
                referred_by_user_id: true, // 二级邀请人
              },
            },
          },
        },
      },
    });

    this.logger.log(`找到 ${trades.length} 笔待处理盈利交易`);

    const result: GasFeeResultDto = {
      processed: trades.length,
      charged: 0,
      skipped: 0,
      failed: 0,
      totalGasFee: '0',
      details: [],
    };

    let totalGasFee = new Decimal(0);

    // 2. 逐笔处理
    for (const trade of trades) {
      const detail: GasFeeDetailDto = {
        tradeId: trade.id,
        symbol: trade.symbol,
        pnl: trade.pnl?.toString() || '0',
        gasFee: '0',
        status: 'skipped',
      };

      try {
        // 检查是否已经处理过（幂等性检查）
        const existingLog = await this.prisma.client.billing_logs.findFirst({
          where: {
            reference_type: 'trade_history',
            reference_id: trade.id,
            billing_type: 'gas_fee',
          },
        });

        if (existingLog) {
          detail.status = 'skipped';
          detail.reason = '已处理过';
          result.skipped++;
          result.details.push(detail);
          continue;
        }

        // 计算燃油费 = 盈利 * 20%
        const pnl = new Decimal(trade.pnl || 0);
        const gasFee = pnl.times(this.GAS_FEE_RATE).toDecimalPlaces(8);
        detail.gasFee = gasFee.toString();

        // 检查用户钱包
        const wallet = trade.users?.wallets;
        if (!wallet) {
          detail.status = 'failed';
          detail.reason = '用户钱包不存在';
          result.failed++;
          result.details.push(detail);
          continue;
        }

        const cardBalance = new Decimal(wallet.card_balance || '0');

        // 规则：从点卡 (card_balance) 扣除
        let cardToDeduct = new Decimal(0);
        let status: 'completed' | 'pending' = 'completed';

        if (cardBalance.gte(gasFee)) {
          // 点卡充足，直接扣除
          cardToDeduct = gasFee;
        } else {
          // 点卡不足，记为欠费
          this.logger.warn(
            `用户 ${trade.user_id} 点卡余额 ${cardBalance} 不足以支付燃油费 ${gasFee}，记为欠费`,
          );
          status = 'pending';
          // 不扣款，只记录
        }

        // 3. 使用事务：扣款 + 记录日志 + 更新交易
        const orderId = this.generateOrderId('gas_fee', trade.id);

        await this.prisma.client.$transaction(async (tx) => {
          // 3.1 扣除点卡
          if (cardToDeduct.gt(0)) {
            const newCardBalance = cardBalance.minus(cardToDeduct);
            await tx.wallets.update({
              where: { user_id: trade.user_id },
              data: {
                card_balance: newCardBalance.toString(),
                updated_at: new Date(),
              },
            });
          }

          // 3.2 创建计费日志
          const deductDesc = status === 'pending'
            ? `交易 ${trade.symbol} 盈利抽成 20% (点卡不足，欠费)`
            : `交易 ${trade.symbol} 盈利抽成 20%`;

          const billingLog = await tx.billing_logs.create({
            data: {
              user_id: trade.user_id,
              unique_order_id: orderId,
              billing_type: 'gas_fee',
              amount: gasFee.toString(),
              currency: 'CARD', // 从点卡扣除
              reference_type: 'trade_history',
              reference_id: trade.id,
              description: deductDesc,
              status,
            },
          });

          // 3.3 更新交易记录的 gas_fee 字段
          await tx.trade_history.update({
            where: { id: trade.id },
            data: {
              gas_fee: gasFee.toString(),
              updated_at: new Date(),
            },
          });

          // ===== 普通用户邀请返佣（与代理商系统独立）=====
          // 检查该用户是否有邀请人，如果有则发放积分返佣
          if (trade.users?.referred_by_user_id) {
            await this.processUserReferralCommission(
              tx,
              trade.user_id,
              trade.users.referred_by_user_id,
              gasFee,
              'gas_fee',
              billingLog.id,
            );
          }

          // ===== Phase 16.7: 策略收益分成 =====
          // 如果交易使用了用户上传的策略，且该策略启用了分成
          if (trade.strategy_id) {
            const strategy = await tx.strategies.findUnique({
              where: { id: trade.strategy_id },
              select: {
                owner_type: true,
                uploader_id: true,
                revenue_share_enabled: true,
                revenue_share_rate: true,
              },
            });

            // 仅对用户上传且启用分成的策略进行分成
            if (
              strategy &&
              strategy.owner_type === 'user' &&
              strategy.revenue_share_enabled &&
              strategy.revenue_share_rate &&
              strategy.uploader_id
            ) {
              const shareRate = new Decimal(strategy.revenue_share_rate);
              const revenueAmount = pnl.times(shareRate); // 从盈利中计算分成金额

              this.logger.log(
                `交易 ${trade.id} 使用用户策略 ${trade.strategy_id}，分成 ${revenueAmount} (${shareRate.times(100)}%)`,
              );

              // 创建策略收益分成记录
              await tx.strategy_revenue_logs.create({
                data: {
                  strategy_id: trade.strategy_id,
                  uploader_id: strategy.uploader_id,
                  user_id: trade.user_id,
                  billing_log_id: billingLog.id, // 直接使用已创建的 billingLog
                  base_amount: pnl.toString(),
                  revenue_share_rate: shareRate.toString(),
                  revenue_amount: revenueAmount.toString(),
                  platform_deduction: revenueAmount.toString(),
                  status: 'settled', // 实时结算
                  settled_at: new Date(),
                },
              });

              // 实时结算：增加策略创作者的余额
              await tx.wallets.upsert({
                where: { user_id: strategy.uploader_id },
                create: {
                  user_id: strategy.uploader_id,
                  usdt_balance: revenueAmount.toString(),
                  card_balance: '0',
                  points_balance: '0',
                },
                update: {
                  usdt_balance: {
                    increment: revenueAmount.toString(),
                  },
                  updated_at: new Date(),
                },
              });

              // 更新策略的累计盈利（用于等级计算）
              await tx.strategies.update({
                where: { id: trade.strategy_id },
                data: {
                  total_profit: {
                    increment: revenueAmount.toString(),
                  },
                  updated_at: new Date(),
                },
              });
            }
          }
        });

        detail.status = 'charged';
        result.charged++;
        totalGasFee = totalGasFee.plus(gasFee);

        this.logger.log(
          `交易 ${trade.id} (${trade.symbol}) 抽成成功: 盈利 ${pnl}, 燃油费 ${gasFee} (从点卡扣除)`,
        );
      } catch (error) {
        // 处理幂等性冲突
        if (error.code === 'P2002') {
          detail.status = 'skipped';
          detail.reason = '订单已存在（幂等性）';
          result.skipped++;
        } else {
          detail.status = 'failed';
          detail.reason = error.message;
          result.failed++;
          this.logger.error(`处理交易 ${trade.id} 失败: ${error.message}`);
        }
      }

      result.details.push(detail);
    }

    result.totalGasFee = totalGasFee.toString();

    this.logger.log(
      `燃油费计算完成: 处理 ${result.processed}, 成功 ${result.charged}, 跳过 ${result.skipped}, 失败 ${result.failed}, 总计 ${result.totalGasFee}`,
    );

    return result;
  }

  /**
   * 获取用户今日盈亏统计
   * @param userId 用户 ID
   */
  async getTodayPnL(userId: string): Promise<TodayPnLDto> {
    // 获取今日开始时间 (UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 查询今日交易
    const trades = await this.prisma.client.trade_history.findMany({
      where: {
        user_id: userId,
        status: 'closed',
        closed_at: { gte: today },
      },
    });

    let todayPnl = new Decimal(0);
    let todayProfit = new Decimal(0);
    let todayLoss = new Decimal(0);
    let todayGasFee = new Decimal(0);
    let winTrades = 0;

    for (const trade of trades) {
      if (trade.pnl) {
        const pnl = new Decimal(trade.pnl);
        todayPnl = todayPnl.plus(pnl);

        if (pnl.gt(0)) {
          todayProfit = todayProfit.plus(pnl);
          winTrades++;
        } else {
          todayLoss = todayLoss.plus(pnl);
        }
      }

      if (trade.gas_fee) {
        todayGasFee = todayGasFee.plus(new Decimal(trade.gas_fee));
      }
    }

    const winRate = trades.length > 0
      ? new Decimal(winTrades).dividedBy(trades.length).times(100)
      : new Decimal(0);

    return {
      todayPnl: todayPnl.toFixed(8),
      todayProfit: todayProfit.toFixed(8),
      todayLoss: todayLoss.toFixed(8),
      todayTrades: trades.length,
      todayWinRate: winRate.toFixed(2),
      todayGasFee: todayGasFee.toFixed(8),
    };
  }

  /**
   * 获取用户当月盈亏统计
   * @param userId 用户 ID
   */
  async getMonthlyPnL(userId: string): Promise<{
    monthlyPnl: string;
    monthlyTrades: number;
    monthlyWinRate: string;
  }> {
    // 获取当月开始时间 (UTC)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setUTCHours(0, 0, 0, 0);

    // 查询当月交易
    const trades = await this.prisma.client.trade_history.findMany({
      where: {
        user_id: userId,
        status: 'closed',
        closed_at: { gte: monthStart },
      },
    });

    let monthlyPnl = new Decimal(0);
    let winTrades = 0;

    for (const trade of trades) {
      if (trade.pnl) {
        const pnl = new Decimal(trade.pnl);
        monthlyPnl = monthlyPnl.plus(pnl);

        if (pnl.gt(0)) {
          winTrades++;
        }
      }
    }

    const winRate = trades.length > 0
      ? new Decimal(winTrades).dividedBy(trades.length)
      : new Decimal(0);

    return {
      monthlyPnl: monthlyPnl.toFixed(8),
      monthlyTrades: trades.length,
      monthlyWinRate: winRate.toFixed(4),
    };
  }

  /**
   * 获取用户收益曲线
   * @param userId 用户 ID
   * @param days 天数（默认 30 天）
   */
  async getPnLCurve(userId: string, days: number = 30): Promise<PnLCurveResponseDto> {
    // 计算开始日期
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setUTCHours(0, 0, 0, 0);

    // 查询时间范围内的交易
    const trades = await this.prisma.client.trade_history.findMany({
      where: {
        user_id: userId,
        status: 'closed',
        closed_at: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { closed_at: 'asc' },
    });

    // 按日期聚合
    const dailyPnL: Map<string, { pnl: Decimal; trades: number }> = new Map();

    for (const trade of trades) {
      if (!trade.closed_at || !trade.pnl) continue;

      const dateKey = trade.closed_at.toISOString().split('T')[0];
      const existing = dailyPnL.get(dateKey) || { pnl: new Decimal(0), trades: 0 };

      dailyPnL.set(dateKey, {
        pnl: existing.pnl.plus(new Decimal(trade.pnl)),
        trades: existing.trades + 1,
      });
    }

    // 生成曲线数据
    const curve: PnLCurvePointDto[] = [];
    let cumulativePnl = new Decimal(0);
    let maxCumulativePnl = new Decimal(0);
    let maxDrawdown = new Decimal(0);

    // 填充所有日期（包括没有交易的日期）
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const dayData = dailyPnL.get(dateKey);

      const dayPnl = dayData?.pnl || new Decimal(0);
      cumulativePnl = cumulativePnl.plus(dayPnl);

      // 计算最大回撤
      if (cumulativePnl.gt(maxCumulativePnl)) {
        maxCumulativePnl = cumulativePnl;
      }
      const drawdown = maxCumulativePnl.minus(cumulativePnl);
      if (drawdown.gt(maxDrawdown)) {
        maxDrawdown = drawdown;
      }

      curve.push({
        date: dateKey,
        pnl: dayPnl.toFixed(8),
        cumulativePnl: cumulativePnl.toFixed(8),
        trades: dayData?.trades || 0,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      curve,
      totalPnl: cumulativePnl.toFixed(8),
      maxDrawdown: maxDrawdown.toFixed(8),
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }

  /**
   * 获取用户计费日志
   * @param userId 用户 ID
   * @param billingType 计费类型（可选）
   */
  async getBillingLogs(
    userId: string,
    billingType?: string,
    limit: number = 50,
  ): Promise<BillingLogResponseDto[]> {
    const where: any = { user_id: userId };

    if (billingType) {
      where.billing_type = billingType;
    }

    const logs = await this.prisma.client.billing_logs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      userId: log.user_id,
      uniqueOrderId: log.unique_order_id,
      billingType: log.billing_type,
      amount: log.amount.toString(),
      currency: log.currency,
      referenceType: log.reference_type,
      referenceId: log.reference_id,
      description: log.description,
      status: log.status,
      createdAt: log.created_at,
    }));
  }

  /**
   * 订阅扣费（幂等，支持积分抵扣）
   * @param userId 用户 ID
   * @param amount 金额 (USDT)
   * @param period 订阅周期描述
   * @param usePoints 是否使用积分抵扣（默认 true）
   *
   * 积分抵扣规则：
   * - 1 积分 = 1 USDT
   * - 优先使用积分，不足部分用 USDT 余额
   */
  async chargeSubscription(
    userId: string,
    amount: string,
    period: string,
    usePoints: boolean = true,
  ): Promise<BillingLogResponseDto & { pointsUsed: string; usdtUsed: string }> {
    const orderId = this.generateOrderId('subscription', userId);
    const chargeAmount = new Decimal(amount);

    // 检查钱包余额和积分余额
    const wallet = await this.prisma.client.wallets.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new BadRequestException('钱包不存在');
    }

    const balance = new Decimal(wallet.usdt_balance);
    const pointsBalance = new Decimal(wallet.points_balance || '0');

    // 计算积分抵扣金额
    let pointsToUse = new Decimal('0');
    let usdtToUse = chargeAmount;

    if (usePoints && pointsBalance.gt(0)) {
      // 积分抵扣：1 积分 = 1 USDT
      const maxPointsDeduct = Decimal.min(pointsBalance, chargeAmount);
      pointsToUse = maxPointsDeduct;
      usdtToUse = chargeAmount.minus(pointsToUse);

      this.logger.log(
        `用户 ${userId} 订阅 ${amount} USDT，积分抵扣 ${pointsToUse}，剩余 ${usdtToUse} USDT`,
      );
    }

    // 检查 USDT 余额是否足够支付剩余部分
    if (balance.lt(usdtToUse)) {
      throw new BadRequestException(
        `余额不足，需支付 ${usdtToUse} USDT (已使用 ${pointsToUse} 积分抵扣)，当前余额 ${balance} USDT`,
      );
    }

    // 事务：扣积分 + 扣 USDT + 记录
    const log = await this.prisma.client.$transaction(async (tx) => {
      // 1. 扣除积分（如有）
      if (pointsToUse.gt(0)) {
        const newPointsBalance = pointsBalance.minus(pointsToUse);
        await tx.wallets.update({
          where: { user_id: userId },
          data: {
            points_balance: newPointsBalance.toString(),
            updated_at: new Date(),
          },
        });

        // 记录积分扣除日志
        await tx.billing_logs.create({
          data: {
            user_id: userId,
            unique_order_id: `${orderId}_points`,
            billing_type: 'points_deduct',
            amount: `-${pointsToUse.toString()}`,
            currency: 'POINTS',
            description: `订阅积分抵扣 - ${period}`,
            status: 'completed',
          },
        });
      }

      // 2. 扣除 USDT（如有）
      if (usdtToUse.gt(0)) {
        const newBalance = balance.minus(usdtToUse);
        await tx.wallets.update({
          where: { user_id: userId },
          data: {
            usdt_balance: newBalance.toString(),
            updated_at: new Date(),
          },
        });
      }

      // 3. 记录订阅扣费日志
      return tx.billing_logs.create({
        data: {
          user_id: userId,
          unique_order_id: orderId,
          billing_type: 'subscription',
          amount: chargeAmount.toString(),
          currency: 'USDT',
          description: `VIP 订阅费 - ${period} (积分抵扣: ${pointsToUse}, USDT: ${usdtToUse})`,
          status: 'completed',
        },
      });
    });

    this.logger.log(
      `用户 ${userId} 订阅扣费成功: ${amount} USDT (积分 ${pointsToUse} + USDT ${usdtToUse})`,
    );

    return {
      id: log.id,
      userId: log.user_id,
      uniqueOrderId: log.unique_order_id,
      billingType: log.billing_type,
      amount: log.amount.toString(),
      currency: log.currency,
      referenceType: log.reference_type,
      referenceId: log.reference_id,
      description: log.description,
      status: log.status,
      createdAt: log.created_at,
      pointsUsed: pointsToUse.toString(),
      usdtUsed: usdtToUse.toString(),
    };
  }

  /**
   * 获取用户订阅状态
   * @param userId 用户 ID
   */
  async getSubscriptionStatus(userId: string) {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        vip_level: true,
        vip_expires_at: true,
        wallets: {
          select: {
            usdt_balance: true,
            points_balance: true,
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 获取最近的订阅扣费记录
    const lastSubscription = await this.prisma.client.billing_logs.findFirst({
      where: {
        user_id: userId,
        billing_type: 'subscription',
        status: 'completed',
      },
      orderBy: { created_at: 'desc' },
    });

    // VIP 等级对应的订阅费用（月）
    const vipPrices: Record<number, number> = {
      0: 0,      // 免费用户
      1: 25,     // VIP1
      2: 50,     // VIP2
      3: 100,    // VIP3
    };

    const isExpired = user.vip_expires_at ? new Date(user.vip_expires_at) < new Date() : true;
    const monthlyPrice = vipPrices[user.vip_level] || 0;

    return {
      userId: user.id,
      vipLevel: user.vip_level,
      vipLevelName: user.vip_level === 0 ? '免费用户' : `VIP${user.vip_level}`,
      isActive: !isExpired && user.vip_level > 0,
      expiresAt: user.vip_expires_at,
      monthlyPrice: monthlyPrice.toString(),
      lastPayment: lastSubscription ? {
        amount: lastSubscription.amount.toString(),
        date: lastSubscription.created_at,
        description: lastSubscription.description,
      } : null,
      wallet: {
        usdtBalance: user.wallets?.usdt_balance?.toString() || '0',
        pointsBalance: user.wallets?.points_balance?.toString() || '0',
      },
    };
  }

  /**
   * 获取用户盈亏汇总（按实例分组）
   * @param userId 用户 ID
   */
  async getPnLByInstance(userId: string) {
    const trades = await this.prisma.client.trade_history.findMany({
      where: {
        user_id: userId,
        status: 'closed',
      },
      include: {
        instances: {
          select: {
            id: true,
            ip_address: true,
            region: true,
          },
        },
      },
    });

    // 按实例分组
    const instancePnL: Map<string, {
      instanceId: string;
      instanceIp: string;
      totalPnl: Decimal;
      totalGasFee: Decimal;
      trades: number;
    }> = new Map();

    for (const trade of trades) {
      const instanceId = trade.instance_id || 'unknown';
      const existing = instancePnL.get(instanceId) || {
        instanceId,
        instanceIp: trade.instances?.ip_address || '未知',
        totalPnl: new Decimal(0),
        totalGasFee: new Decimal(0),
        trades: 0,
      };

      if (trade.pnl) {
        existing.totalPnl = existing.totalPnl.plus(new Decimal(trade.pnl));
      }
      if (trade.gas_fee) {
        existing.totalGasFee = existing.totalGasFee.plus(new Decimal(trade.gas_fee));
      }
      existing.trades++;

      instancePnL.set(instanceId, existing);
    }

    return Array.from(instancePnL.values()).map((item) => ({
      instanceId: item.instanceId,
      instanceIp: item.instanceIp,
      totalPnl: item.totalPnl.toFixed(8),
      totalGasFee: item.totalGasFee.toFixed(8),
      netPnl: item.totalPnl.minus(item.totalGasFee).toFixed(8),
      trades: item.trades,
    }));
  }

  // ===== 普通用户邀请返佣系统（与代理商系统完全独立）=====

  // 一级返佣比例：10%
  private readonly USER_REFERRAL_RATE_L1 = new Decimal('0.10');
  // 二级返佣比例：5%
  private readonly USER_REFERRAL_RATE_L2 = new Decimal('0.05');

  /**
   * 处理普通用户邀请返佣
   * 当被邀请用户产生消费时，给邀请人发放积分返佣
   *
   * 规则：
   * - 一级返佣：10%（直接邀请人）
   * - 二级返佣：5%（邀请人的邀请人）
   * - 返佣以积分形式发放
   *
   * @param tx 事务对象
   * @param inviteeId 被邀请人（消费者）ID
   * @param referrerId 一级邀请人 ID
   * @param baseAmount 消费基数（燃油费或订阅费）
   * @param sourceType 来源类型：gas_fee | subscription
   * @param sourceId 关联的账单 ID
   */
  private async processUserReferralCommission(
    tx: any,
    inviteeId: string,
    referrerId: string,
    baseAmount: Decimal,
    sourceType: string,
    sourceId: string,
  ): Promise<void> {
    // 防止自己邀请自己（理论上不应发生）
    if (inviteeId === referrerId) {
      this.logger.warn(`用户 ${inviteeId} 的邀请人是自己，跳过返佣`);
      return;
    }

    // ===== 一级返佣 =====
    const l1Commission = baseAmount.times(this.USER_REFERRAL_RATE_L1).toDecimalPlaces(8);

    if (l1Commission.gt(0)) {
      // 创建一级返佣记录
      await tx.user_commissions.create({
        data: {
          referrer_id: referrerId,
          invitee_id: inviteeId,
          level: 1,
          source_type: sourceType,
          source_id: sourceId,
          base_amount: baseAmount.toString(),
          commission_rate: this.USER_REFERRAL_RATE_L1.toString(),
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
        `一级返佣：用户 ${inviteeId} 消费 ${baseAmount}，邀请人 ${referrerId} 获得 ${l1Commission} 积分 (10%)`,
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
          const l2Commission = baseAmount.times(this.USER_REFERRAL_RATE_L2).toDecimalPlaces(8);

          if (l2Commission.gt(0)) {
            // 创建二级返佣记录
            await tx.user_commissions.create({
              data: {
                referrer_id: l2ReferrerId,
                invitee_id: inviteeId,
                level: 2,
                source_type: sourceType,
                source_id: sourceId,
                base_amount: baseAmount.toString(),
                commission_rate: this.USER_REFERRAL_RATE_L2.toString(),
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
              `二级返佣：用户 ${inviteeId} 消费 ${baseAmount}，二级邀请人 ${l2ReferrerId} 获得 ${l2Commission} 积分 (5%)`,
            );
          }
        }
      }
    }
  }
}
