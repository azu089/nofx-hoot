import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceOverviewDto } from './dto/wallet-response.dto';
import Decimal from 'decimal.js';

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

  // TODO: 实现充值逻辑（需要事务）
  // TODO: 实现提现逻辑（需要事务 + 审核）
  // TODO: 实现交易记录查询
}
