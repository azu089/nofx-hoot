import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';
import {
  BalanceResponse,
  TransactionListResponse,
  CreateWithdrawDto,
  WithdrawRequestResponse,
  TransactionQueryDto,
  DepositAddressResponse,
} from './dto/wallet.dto';
import { HdWalletService } from '../blockchain/hd-wallet.service';
import { WithdrawService } from '../blockchain/withdraw.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  // 提现手续费率
  private readonly WITHDRAW_FEE_RATE = 0.001; // 0.1%
  private readonly MIN_WITHDRAW_AMOUNT = {
    USDT: 10,
    HOOT: 100,
  };

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => HdWalletService))
    private hdWalletService: HdWalletService,
    @Inject(forwardRef(() => WithdrawService))
    private withdrawService: WithdrawService,
  ) {}

  // 获取用户余额
  async getBalance(userId: string): Promise<BalanceResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        usdtBalance: true,
        hootBalance: true,
        pointBalance: true,
      },
    });

    return {
      usdt: user?.usdtBalance.toString() || '0',
      hoot: user?.hootBalance.toString() || '0',
      point: user?.pointBalance.toString() || '0',
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

  // 获取充值历史（最近 50 条）
  async getDeposits(userId: string) {
    const items = await this.prisma.transaction.findMany({
      where: { userId, type: 'deposit' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      items: items.map((t) => ({
        id: t.id,
        amount: t.amount.toString(),
        chain: t.chain || 'BSC', // 优先使用记录的链名，兼容旧数据默认 BSC
        txHash: t.txHash || '',
        status: t.status,
        createdAt: t.createdAt,
      })),
      total: items.length,
    };
  }

  /**
   * 获取充值地址
   *
   * 策略：
   * - EVM 链（BSC/ETH/Polygon）共用同一个地址（0x...格式在所有 EVM 链通用）
   * - TRON 使用独立地址（T...格式）
   * - 返回当前展示地址；如果没有或 refresh=true，生成新地址
   * - 所有旧地址仍然有效（用户转到旧地址也能自动到账）
   */
  async getDepositAddress(
    userId: string,
    chain: string,
    asset: string,
    refresh = false,
  ): Promise<DepositAddressResponse> {
    const EVM_CHAINS = ['BSC', 'ETH', 'POLYGON'];
    const isEvmChain = EVM_CHAINS.includes(chain);

    // 如果不是刷新，先查找当前地址
    if (!refresh) {
      let currentAddress;

      if (isEvmChain) {
        // EVM 链共用地址：查找任意 EVM 链的当前地址
        currentAddress = await this.prisma.depositAddress.findFirst({
          where: {
            userId,
            chain: { in: EVM_CHAINS },
            asset,
            isCurrent: true,
          },
        });
      } else {
        // 非 EVM 链（TRON）：精确匹配
        currentAddress = await this.prisma.depositAddress.findFirst({
          where: { userId, chain, asset, isCurrent: true },
        });
      }

      if (currentAddress) {
        return {
          chain,
          asset: currentAddress.asset,
          address: currentAddress.address,
        };
      }
    }

    // 生成新的 HD 派生地址
    if (this.hdWalletService.getIsInitialized()) {
      // 对 EVM 链，用 BSC 作为存储链标识（实际地址通用）
      const storageChain = isEvmChain ? 'BSC' : chain;
      const { address } = await this.hdWalletService.generateDepositAddress(
        userId,
        storageChain,
        asset,
      );

      return { chain, asset, address };
    }

    // 兜底：HD 钱包未配置时使用模拟地址（仅开发环境）
    this.logger.warn('HD 钱包未配置，生成模拟地址（仅用于开发测试）');
    const mockAddress = chain === 'TRON'
      ? `T${uuidv4().replace(/-/g, '').slice(0, 33)}`
      : `0x${uuidv4().replace(/-/g, '').slice(0, 40)}`;

    await this.prisma.depositAddress.updateMany({
      where: { userId, chain, asset, isCurrent: true },
      data: { isCurrent: false },
    });

    await this.prisma.depositAddress.create({
      data: {
        userId,
        chain,
        asset,
        address: mockAddress,
        derivationIndex: -1, // 标记为模拟地址
        isCurrent: true,
      },
    });

    return { chain, asset, address: mockAddress };
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
      throw new BadRequestException(`${asset} 最小提现金额为 ${minAmount}`);
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

    const balance = asset === 'USDT' ? user!.usdtBalance : user!.hootBalance;

    if (new Decimal(balance).lessThan(totalAmount)) {
      throw new BadRequestException('余额不足');
    }

    // 使用事务创建提现申请并冻结余额
    const result = await this.prisma.$transaction(async (tx) => {
      // 扣减余额
      const balanceField = asset === 'USDT' ? 'usdtBalance' : 'hootBalance';

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
          chain,
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

    // 异步触发分级提现处理（不阻塞用户请求）
    this.withdrawService
      .processNewWithdraw(result.id)
      .then((processResult) => {
        if (processResult.action === 'auto_executed') {
          this.logger.log(`提现 ${result.id} 已自动执行`);
        } else {
          this.logger.log(`提现 ${result.id} 等待人工审核`);
        }
      })
      .catch((err) => {
        this.logger.error(`提现处理异常: ${err.message}`);
      });

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
    chain?: string,
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
      const balanceField = asset === 'USDT' ? 'usdtBalance' : 'hootBalance';

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
          chain: chain || null,
          amount: new Decimal(amount),
          uniqueOrderId,
          status: 'completed',
          txHash,
        },
      });
    });

    this.logger.log(`用户 ${userId} 充值成功: ${amount} ${asset} (${chain || 'unknown'})`);
  }

  // 兑换接口
  // 支持: USDT <-> POINT (1:1), USDT <-> HOOT (按市场价)
  async exchange(
    userId: string,
    fromAsset: 'USDT' | 'HOOT' | 'POINT',
    toAsset: 'USDT' | 'HOOT' | 'POINT',
    amount: number,
  ): Promise<{ fromAmount: string; toAmount: string; rate: string }> {
    if (fromAsset === toAsset) {
      throw new BadRequestException('来源和目标资产不能相同');
    }

    // 获取用户当前余额
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        usdtBalance: true,
        hootBalance: true,
        pointBalance: true,
      },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 检查来源余额
    const fromBalance = this.getBalanceByAsset(user, fromAsset);
    const fromAmount = new Decimal(amount);

    if (fromBalance.lessThan(fromAmount)) {
      throw new BadRequestException(`${fromAsset} 余额不足`);
    }

    // 计算兑换汇率和目标金额
    const rate = this.getExchangeRate(fromAsset, toAsset);
    const toAmount = fromAmount.times(rate);

    // 执行兑换（事务）
    await this.prisma.$transaction(async (tx) => {
      // 扣除来源资产
      await this.updateBalance(tx, userId, fromAsset, fromAmount.negated());

      // 增加目标资产
      await this.updateBalance(tx, userId, toAsset, toAmount);

      // 记录交易
      const uniqueOrderId = `exchange_${userId}_${Date.now()}_${uuidv4().slice(0, 8)}`;

      await tx.transaction.create({
        data: {
          userId,
          type: 'exchange',
          asset: fromAsset,
          amount: fromAmount.negated(),
          uniqueOrderId,
          status: 'completed',
          remark: `兑换 ${fromAmount} ${fromAsset} -> ${toAmount.toFixed(8)} ${toAsset}`,
        },
      });
    });

    this.logger.log(
      `用户 ${userId} 兑换: ${amount} ${fromAsset} -> ${toAmount.toFixed(8)} ${toAsset} (汇率: ${rate})`,
    );

    return {
      fromAmount: fromAmount.toString(),
      toAmount: toAmount.toFixed(8),
      rate: rate.toString(),
    };
  }

  // 获取指定资产的余额
  private getBalanceByAsset(
    user: { usdtBalance: Decimal; hootBalance: Decimal; pointBalance: Decimal },
    asset: 'USDT' | 'HOOT' | 'POINT',
  ): Decimal {
    switch (asset) {
      case 'USDT':
        return new Decimal(user.usdtBalance.toString());
      case 'HOOT':
        return new Decimal(user.hootBalance.toString());
      case 'POINT':
        return new Decimal(user.pointBalance.toString());
    }
  }

  // 获取兑换汇率
  // USDT <-> POINT: 1:1
  // USDT <-> HOOT: 假设 1 HOOT = 0.15 USDT（实际应从市场获取）
  private getExchangeRate(
    fromAsset: 'USDT' | 'HOOT' | 'POINT',
    toAsset: 'USDT' | 'HOOT' | 'POINT',
  ): Decimal {
    const HOOT_PRICE_IN_USDT = new Decimal('0.15');

    // USDT <-> POINT (1:1)
    if (
      (fromAsset === 'USDT' && toAsset === 'POINT') ||
      (fromAsset === 'POINT' && toAsset === 'USDT')
    ) {
      return new Decimal(1);
    }

    // USDT -> HOOT
    if (fromAsset === 'USDT' && toAsset === 'HOOT') {
      return new Decimal(1).div(HOOT_PRICE_IN_USDT);
    }

    // HOOT -> USDT
    if (fromAsset === 'HOOT' && toAsset === 'USDT') {
      return HOOT_PRICE_IN_USDT;
    }

    // POINT -> HOOT (先换成 USDT 再换成 HOOT)
    if (fromAsset === 'POINT' && toAsset === 'HOOT') {
      return new Decimal(1).div(HOOT_PRICE_IN_USDT);
    }

    // HOOT -> POINT (先换成 USDT 再换成 POINT)
    if (fromAsset === 'HOOT' && toAsset === 'POINT') {
      return HOOT_PRICE_IN_USDT;
    }

    throw new BadRequestException('不支持的兑换路径');
  }

  // 更新用户余额
  private async updateBalance(
    tx: any,
    userId: string,
    asset: 'USDT' | 'HOOT' | 'POINT',
    amount: Decimal,
  ): Promise<void> {
    const fieldMap = {
      USDT: 'usdtBalance',
      HOOT: 'hootBalance',
      POINT: 'pointBalance',
    };

    const field = fieldMap[asset];

    if (amount.greaterThan(0)) {
      await tx.user.update({
        where: { id: userId },
        data: { [field]: { increment: amount } },
      });
    } else {
      await tx.user.update({
        where: { id: userId },
        data: { [field]: { decrement: amount.abs() } },
      });
    }
  }
}
