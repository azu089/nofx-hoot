import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';
import {
  BalanceResponse,
  TransactionResponse,
  TransactionListResponse,
  CreateWithdrawDto,
  WithdrawRequestResponse,
  DepositAddressResponse,
  TransactionQueryDto,
} from './dto/wallet.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  // 提现手续费率
  private readonly WITHDRAW_FEE_RATE = 0.001; // 0.1%
  private readonly MIN_WITHDRAW_AMOUNT = {
    USDT: 10,
    HOOT: 100,
  };

  constructor(private prisma: PrismaService) {}

  // 获取用户余额
  async getBalance(userId: string): Promise<BalanceResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        usdtBalance: true,
        hootBalance: true,
      },
    });

    return {
      usdt: user?.usdtBalance.toString() || '0',
      hoot: user?.hootBalance.toString() || '0',
    };
  }

  // 获取交易记录
  async getTransactions(
    userId: string,
    query: TransactionQueryDto,
  ): Promise<TransactionListResponse> {
    const { type, asset, page = 1, pageSize = 20 } = query;

    const where: any = { userId };
    if (type) where.type = type;
    if (asset) where.asset = asset;

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        type: t.type,
        asset: t.asset,
        amount: t.amount.toString(),
        status: t.status,
        txHash: t.txHash || undefined,
        remark: t.remark || undefined,
        createdAt: t.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  // 获取充值地址
  async getDepositAddress(
    userId: string,
    chain: string,
    asset: string,
  ): Promise<DepositAddressResponse> {
    // 查找现有地址
    let depositAddress = await this.prisma.depositAddress.findUnique({
      where: {
        userId_chain_asset: {
          userId,
          chain,
          asset,
        },
      },
    });

    // 如果没有，生成新地址
    if (!depositAddress) {
      // TODO: 实际项目中应该调用钱包服务生成真实地址
      // 这里暂时生成一个模拟地址
      const mockAddress = `0x${uuidv4().replace(/-/g, '').slice(0, 40)}`;

      depositAddress = await this.prisma.depositAddress.create({
        data: {
          userId,
          chain,
          asset,
          address: mockAddress,
        },
      });
    }

    return {
      chain: depositAddress.chain,
      asset: depositAddress.asset,
      address: depositAddress.address,
    };
  }

  // 创建提现申请
  async createWithdrawRequest(
    userId: string,
    dto: CreateWithdrawDto,
  ): Promise<WithdrawRequestResponse> {
    const { asset, amount, chain, address } = dto;

    // 检查最小提现金额
    const minAmount = this.MIN_WITHDRAW_AMOUNT[asset];
    if (amount < minAmount) {
      throw new BadRequestException(
        `${asset} 最小提现金额为 ${minAmount}`,
      );
    }

    // 计算手续费
    const fee = new Decimal(amount).times(this.WITHDRAW_FEE_RATE);
    const totalAmount = new Decimal(amount).plus(fee);

    // 检查余额
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        usdtBalance: true,
        hootBalance: true,
      },
    });

    const balance =
      asset === 'USDT' ? user!.usdtBalance : user!.hootBalance;

    if (new Decimal(balance).lessThan(totalAmount)) {
      throw new BadRequestException('余额不足');
    }

    // 使用事务创建提现申请并冻结余额
    const result = await this.prisma.$transaction(async (tx) => {
      // 扣减余额
      const balanceField =
        asset === 'USDT' ? 'usdtBalance' : 'hootBalance';

      await tx.user.update({
        where: { id: userId },
        data: {
          [balanceField]: {
            decrement: totalAmount,
          },
        },
      });

      // 创建提现申请
      const withdrawRequest = await tx.withdrawRequest.create({
        data: {
          userId,
          asset,
          amount: new Decimal(amount),
          fee,
          chain,
          address,
          status: 'pending',
        },
      });

      // 创建交易记录
      await tx.transaction.create({
        data: {
          userId,
          type: 'withdraw',
          asset,
          amount: new Decimal(amount).negated(), // 负数表示支出
          uniqueOrderId: `withdraw_${withdrawRequest.id}`,
          status: 'pending',
          remark: `提现到 ${chain} ${address.slice(0, 10)}...`,
        },
      });

      return withdrawRequest;
    });

    this.logger.log(
      `用户 ${userId} 提现申请: ${amount} ${asset} -> ${address}`,
    );

    return {
      id: result.id,
      asset: result.asset,
      amount: result.amount.toString(),
      fee: result.fee.toString(),
      chain: result.chain,
      address: result.address,
      status: result.status,
      createdAt: result.createdAt,
    };
  }

  // 获取提现记录
  async getWithdrawRequests(
    userId: string,
  ): Promise<WithdrawRequestResponse[]> {
    const requests = await this.prisma.withdrawRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => ({
      id: r.id,
      asset: r.asset,
      amount: r.amount.toString(),
      fee: r.fee.toString(),
      chain: r.chain,
      address: r.address,
      status: r.status,
      txHash: r.txHash || undefined,
      createdAt: r.createdAt,
    }));
  }

  // 内部方法：增加用户余额（充值回调使用）
  async increaseBalance(
    userId: string,
    asset: 'USDT' | 'HOOT',
    amount: string,
    txHash: string,
  ): Promise<void> {
    const uniqueOrderId = `deposit_${txHash}`;

    // 幂等性检查
    const existing = await this.prisma.transaction.findUnique({
      where: { uniqueOrderId },
    });

    if (existing) {
      this.logger.warn(`充值已处理: ${txHash}`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // 增加余额
      const balanceField =
        asset === 'USDT' ? 'usdtBalance' : 'hootBalance';

      await tx.user.update({
        where: { id: userId },
        data: {
          [balanceField]: {
            increment: new Decimal(amount),
          },
        },
      });

      // 创建交易记录
      await tx.transaction.create({
        data: {
          userId,
          type: 'deposit',
          asset,
          amount: new Decimal(amount),
          uniqueOrderId,
          status: 'completed',
          txHash,
        },
      });
    });

    this.logger.log(`用户 ${userId} 充值成功: ${amount} ${asset}`);
  }
}
