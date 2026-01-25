import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  GetQuoteDto,
  QuoteResponseDto,
  AssetType,
  ExchangeMode,
} from './dto/quote.dto';
import { ConvertDto, ConvertResponseDto } from './dto/convert.dto';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';

// 报价缓存有效期（秒）
const QUOTE_EXPIRY_SECONDS = 30;

// 兑换规则类型
interface ExchangeRule {
  rate: string;
  feeRate: string;
  minAmount: string;
  enabled: boolean;
}

// 点卡套餐配置（与前端 wallet/exchange/page.tsx 同步）
const CARD_PACKAGES = [
  { amount: 50, bonus: 0, label: '体验' },
  { amount: 100, bonus: 5, label: '入门' },    // +5%
  { amount: 200, bonus: 8, label: '标准' },    // +8%
  { amount: 500, bonus: 12, label: '高级' },   // +12%
  { amount: 1000, bonus: 18, label: '尊享' },  // +18%
  { amount: 2000, bonus: 25, label: '旗舰' },  // +25%
];

// 兑换规则配置
const EXCHANGE_RULES: Record<string, ExchangeRule> = {
  // USDT → 点卡: 1:1, 无手续费
  'usdt_card': {
    rate: '1',
    feeRate: '0',
    minAmount: '10',
    enabled: true,
  },
  // USDT → QFI: 市场价, 1%手续费
  'usdt_token': {
    rate: '0.1', // 1 USDT = 0.1 QFI (模拟价格，实际应从DEX获取)
    feeRate: '0.01',
    minAmount: '1',
    enabled: true,
  },
  // 积分 → QFI: 1000:1, 无手续费
  'points_token': {
    rate: '0.001', // 1000 积分 = 1 QFI
    feeRate: '0',
    minAmount: '1000',
    enabled: true,
  },
  // QFI → USDT: 市场价, 1%手续费
  'token_usdt': {
    rate: '10', // 1 QFI = 10 USDT (模拟价格)
    feeRate: '0.01',
    minAmount: '1',
    enabled: true,
  },
};

@Injectable()
export class ExchangeService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * 获取兑换报价
   */
  async getQuote(userId: string, dto: GetQuoteDto): Promise<QuoteResponseDto> {
    const { from_asset, to_asset, amount, mode = ExchangeMode.STANDARD } = dto;

    // 1. 验证兑换规则
    const ruleKey = `${from_asset}_${to_asset}`;
    const rule = EXCHANGE_RULES[ruleKey];

    if (!rule || !rule.enabled) {
      throw new BadRequestException(`不支持 ${from_asset} → ${to_asset} 兑换`);
    }

    // 2. 验证最低金额
    const fromAmount = new Decimal(amount);
    if (fromAmount.lt(rule.minAmount)) {
      throw new BadRequestException(`最低兑换金额为 ${rule.minAmount} ${from_asset.toUpperCase()}`);
    }

    // 3. 验证用户余额
    const wallet = await this.prisma.client.wallets.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      throw new BadRequestException('钱包不存在');
    }

    const availableBalance = this.getAvailableBalance(wallet, from_asset);
    if (fromAmount.gt(availableBalance)) {
      throw new BadRequestException(`${from_asset.toUpperCase()} 余额不足`);
    }

    // 4. 计算兑换金额
    const rate = new Decimal(rule.rate);
    const feeRate = new Decimal(rule.feeRate);
    const feeAmount = fromAmount.mul(feeRate);
    const netAmount = fromAmount.minus(feeAmount);
    let toAmount = netAmount.mul(rate);

    // 4.5 USDT → 点卡套餐赠送计算
    let bonusRate = '0';
    let bonusAmount = new Decimal(0);
    if (from_asset === AssetType.USDT && to_asset === AssetType.CARD) {
      // 从高到低匹配套餐
      for (let i = CARD_PACKAGES.length - 1; i >= 0; i--) {
        const pkg = CARD_PACKAGES[i];
        if (fromAmount.gte(pkg.amount)) {
          bonusRate = (pkg.bonus / 100).toString();
          bonusAmount = toAmount.mul(bonusRate);
          toAmount = toAmount.plus(bonusAmount);
          break;
        }
      }
    }

    // 5. 积分兑换特殊处理
    let instantAmount: string | undefined;
    let vestingAmount: string | undefined;
    let vestingDays: number | undefined;
    let burnedAmount: string | undefined;

    if (from_asset === AssetType.POINTS && to_asset === AssetType.TOKEN) {
      if (mode === ExchangeMode.STANDARD) {
        // 标准模式：20%立即 + 80%锁仓90天
        instantAmount = toAmount.mul('0.2').toFixed(8);
        vestingAmount = toAmount.mul('0.8').toFixed(8);
        vestingDays = 90;
      } else {
        // 急速模式：50%立即 + 50%销毁
        instantAmount = toAmount.mul('0.5').toFixed(8);
        burnedAmount = toAmount.mul('0.5').toFixed(8);
        vestingAmount = '0';
      }
    }

    // 6. 生成报价 ID 并缓存
    const quoteId = `q_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + QUOTE_EXPIRY_SECONDS * 1000);

    const quoteData = {
      userId,
      from_asset,
      from_amount: fromAmount.toFixed(8),
      to_asset,
      to_amount: toAmount.toFixed(8),
      exchange_rate: rate.toFixed(8),
      fee_rate: feeRate.toFixed(4),
      fee_amount: feeAmount.toFixed(8),
      bonus_rate: bonusRate,
      bonus_amount: bonusAmount.toFixed(8),
      mode,
      instant_amount: instantAmount,
      vesting_amount: vestingAmount,
      vesting_days: vestingDays,
      burned_amount: burnedAmount,
      expires_at: expiresAt.toISOString(),
    };

    await this.redis.set(
      `exchange_quote:${quoteId}`,
      JSON.stringify(quoteData),
      QUOTE_EXPIRY_SECONDS,
    );

    return {
      quote_id: quoteId,
      from_asset,
      from_amount: fromAmount.toFixed(8),
      to_asset,
      to_amount: toAmount.toFixed(8),
      exchange_rate: rate.toFixed(8),
      fee_rate: feeRate.toFixed(4),
      fee_amount: feeAmount.toFixed(8),
      bonus_rate: bonusRate,
      bonus_amount: bonusAmount.toFixed(8),
      expires_at: expiresAt.toISOString(),
      instant_amount: instantAmount,
      vesting_amount: vestingAmount,
      vesting_days: vestingDays,
      burned_amount: burnedAmount,
    };
  }

  /**
   * 执行兑换
   */
  async convert(userId: string, dto: ConvertDto): Promise<ConvertResponseDto> {
    const { quote_id } = dto;

    // 1. 获取并验证报价
    const quoteDataStr = await this.redis.get(`exchange_quote:${quote_id}`);
    if (!quoteDataStr) {
      throw new BadRequestException('报价已过期，请重新获取');
    }

    const quoteData = JSON.parse(quoteDataStr);

    // 验证用户
    if (quoteData.userId !== userId) {
      throw new BadRequestException('无效的报价');
    }

    // 验证是否过期
    if (new Date(quoteData.expires_at) < new Date()) {
      throw new BadRequestException('报价已过期，请重新获取');
    }

    // 2. 删除报价（防止重复使用）
    await this.redis.del(`exchange_quote:${quote_id}`);

    // 3. 执行兑换（事务）
    const result = await this.prisma.client.$transaction(async (tx) => {
      // 获取钱包
      const wallet = await tx.wallets.findUnique({
        where: { user_id: userId },
      });

      if (!wallet) {
        throw new BadRequestException('钱包不存在');
      }

      // 再次验证余额
      const fromAmount = new Decimal(quoteData.from_amount);
      const availableBalance = this.getAvailableBalance(
        wallet,
        quoteData.from_asset,
      );
      if (fromAmount.gt(availableBalance)) {
        throw new BadRequestException(
          `${quoteData.from_asset.toUpperCase()} 余额不足`,
        );
      }

      // 准备更新数据
      const updateData: Record<string, unknown> = {};
      const toAmount = new Decimal(quoteData.to_amount);

      // 扣除来源资产
      switch (quoteData.from_asset) {
        case AssetType.USDT:
          updateData.usdt_balance = new Decimal(wallet.usdt_balance.toString())
            .minus(fromAmount)
            .toFixed(8);
          break;
        case AssetType.CARD:
          updateData.card_balance = new Decimal(wallet.card_balance.toString())
            .minus(fromAmount)
            .toFixed(8);
          break;
        case AssetType.POINTS:
          updateData.points_balance = new Decimal(
            wallet.points_balance.toString(),
          )
            .minus(fromAmount)
            .toFixed(8);
          break;
        case AssetType.TOKEN:
          updateData.token_balance = new Decimal(wallet.token_balance.toString())
            .minus(fromAmount)
            .toFixed(8);
          break;
      }

      // 增加目标资产
      if (
        quoteData.from_asset === AssetType.POINTS &&
        quoteData.to_asset === AssetType.TOKEN
      ) {
        // 积分兑换特殊处理
        const instantAmount = new Decimal(quoteData.instant_amount || '0');
        const vestingAmount = new Decimal(quoteData.vesting_amount || '0');

        updateData.token_balance = new Decimal(wallet.token_balance.toString())
          .plus(instantAmount)
          .toFixed(8);

        if (vestingAmount.gt(0)) {
          updateData.token_vesting = new Decimal(
            wallet.token_vesting.toString(),
          )
            .plus(vestingAmount)
            .toFixed(8);
        }
      } else {
        switch (quoteData.to_asset) {
          case AssetType.USDT:
            updateData.usdt_balance = new Decimal(
              wallet.usdt_balance.toString(),
            )
              .plus(toAmount)
              .toFixed(8);
            break;
          case AssetType.CARD:
            updateData.card_balance = new Decimal(
              wallet.card_balance.toString(),
            )
              .plus(toAmount)
              .toFixed(8);
            break;
          case AssetType.TOKEN:
            updateData.token_balance = new Decimal(
              wallet.token_balance.toString(),
            )
              .plus(toAmount)
              .toFixed(8);
            break;
        }
      }

      updateData.updated_at = new Date();

      // 更新钱包
      const updatedWallet = await tx.wallets.update({
        where: { user_id: userId },
        data: updateData,
      });

      // 创建兑换记录
      const transactionId = randomUUID();
      await tx.exchange_transactions.create({
        data: {
          id: transactionId,
          user_id: userId,
          from_asset: quoteData.from_asset,
          from_amount: quoteData.from_amount,
          to_asset: quoteData.to_asset,
          to_amount: quoteData.to_amount,
          exchange_rate: quoteData.exchange_rate,
          fee_rate: quoteData.fee_rate,
          fee_amount: quoteData.fee_amount,
          mode: quoteData.mode,
          instant_amount: quoteData.instant_amount,
          vesting_amount: quoteData.vesting_amount,
          burned_amount: quoteData.burned_amount,
          status: 'completed',
        },
      });

      // 积分→QFI 兑换：同时创建 token_orders 记录，以便释放定时任务处理
      if (
        quoteData.from_asset === AssetType.POINTS &&
        quoteData.to_asset === AssetType.TOKEN
      ) {
        const vestingAmount = new Decimal(quoteData.vesting_amount || '0');
        const instantAmount = new Decimal(quoteData.instant_amount || '0');
        const burnedAmount = new Decimal(quoteData.burned_amount || '0');
        const tokensTotal = new Decimal(quoteData.to_amount);

        // 计算释放结束日期（标准模式 90 天后）
        let vestingEndAt: Date | null = null;
        if (quoteData.mode === ExchangeMode.STANDARD && vestingAmount.gt(0)) {
          vestingEndAt = new Date();
          vestingEndAt.setDate(vestingEndAt.getDate() + (quoteData.vesting_days || 90));
        }

        await tx.token_orders.create({
          data: {
            user_id: userId,
            points_spent: quoteData.from_amount,
            tokens_total: tokensTotal.toFixed(8),
            exchange_rate: '1000', // 1000 积分 = 1 QFI
            vesting_mode: quoteData.mode === ExchangeMode.STANDARD ? 'standard' : 'fast',
            tokens_released: instantAmount.toFixed(8),
            tokens_pending: vestingAmount.toFixed(8),
            tokens_burned: burnedAmount.toFixed(8),
            vesting_start_at: new Date(),
            vesting_end_at: vestingEndAt,
            last_release_at: quoteData.mode === ExchangeMode.STANDARD ? new Date() : null,
            status: quoteData.mode === ExchangeMode.STANDARD && vestingAmount.gt(0) ? 'vesting' : 'completed',
          },
        });

        // 急速模式记录销毁
        if (quoteData.mode === ExchangeMode.INSTANT && burnedAmount.gt(0)) {
          await tx.token_burns.create({
            data: {
              source_type: 'fast_exchange',
              source_id: transactionId,
              amount: burnedAmount.toFixed(8),
            },
          });
        }
      }

      // 创建账单记录
      await tx.billing_logs.create({
        data: {
          user_id: userId,
          unique_order_id: `exchange_${userId}_${Date.now()}_${transactionId.slice(0, 8)}`,
          billing_type: 'exchange',
          amount: quoteData.from_amount,
          currency: quoteData.from_asset.toUpperCase(),
          description: `${quoteData.from_asset.toUpperCase()} → ${quoteData.to_asset.toUpperCase()} 兑换`,
          status: 'completed',
        },
      });

      return {
        transactionId,
        updatedWallet,
      };
    });

    // 获取新余额
    const newFromBalance = this.getBalanceByAsset(
      result.updatedWallet,
      quoteData.from_asset,
    );
    const newToBalance = this.getBalanceByAsset(
      result.updatedWallet,
      quoteData.to_asset,
    );

    return {
      success: true,
      transaction_id: result.transactionId,
      from_asset: quoteData.from_asset,
      from_amount: quoteData.from_amount,
      to_asset: quoteData.to_asset,
      to_amount: quoteData.to_amount,
      new_from_balance: newFromBalance,
      new_to_balance: newToBalance,
    };
  }

  /**
   * 获取兑换历史
   */
  async getHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    items: unknown[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.client.exchange_transactions.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.exchange_transactions.count({
        where: { user_id: userId },
      }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        from_asset: item.from_asset,
        from_amount: item.from_amount.toString(),
        to_asset: item.to_asset,
        to_amount: item.to_amount.toString(),
        exchange_rate: item.exchange_rate.toString(),
        fee_amount: item.fee_amount.toString(),
        mode: item.mode,
        status: item.status,
        created_at: item.created_at.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * 获取可用余额
   */
  private getAvailableBalance(
    wallet: Record<string, unknown>,
    asset: AssetType,
  ): Decimal {
    switch (asset) {
      case AssetType.USDT:
        return new Decimal(wallet.usdt_balance?.toString() || '0').minus(
          new Decimal(wallet.usdt_frozen?.toString() || '0'),
        );
      case AssetType.CARD:
        return new Decimal(wallet.card_balance?.toString() || '0');
      case AssetType.POINTS:
        return new Decimal(wallet.points_balance?.toString() || '0')
          .minus(new Decimal(wallet.points_frozen?.toString() || '0'))
          .minus(new Decimal(wallet.points_locked?.toString() || '0'));
      case AssetType.TOKEN:
        return new Decimal(wallet.token_balance?.toString() || '0').minus(
          new Decimal(wallet.token_locked?.toString() || '0'),
        );
      default:
        return new Decimal(0);
    }
  }

  /**
   * 根据资产类型获取余额
   */
  private getBalanceByAsset(
    wallet: Record<string, unknown>,
    asset: AssetType,
  ): string {
    switch (asset) {
      case AssetType.USDT:
        return wallet.usdt_balance?.toString() || '0';
      case AssetType.CARD:
        return wallet.card_balance?.toString() || '0';
      case AssetType.POINTS:
        return wallet.points_balance?.toString() || '0';
      case AssetType.TOKEN:
        return wallet.token_balance?.toString() || '0';
      default:
        return '0';
    }
  }

  /**
   * 获取支持的兑换对
   */
  getSupportedPairs(): { from: AssetType; to: AssetType; rule: unknown }[] {
    return Object.entries(EXCHANGE_RULES)
      .filter(([, rule]) => rule.enabled)
      .map(([key, rule]) => {
        const [from, to] = key.split('_') as [AssetType, AssetType];
        return {
          from,
          to,
          rule: {
            rate: rule.rate,
            feeRate: rule.feeRate,
            minAmount: rule.minAmount,
          },
        };
      });
  }
}
