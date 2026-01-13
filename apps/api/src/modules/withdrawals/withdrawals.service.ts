import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { TotpService } from '../../common/services/totp.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalResponseDto } from './dto/withdrawal-response.dto';
import Decimal from 'decimal.js';

/**
 * 提现服务
 * 处理提现申请、审核等业务逻辑
 */
@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  // 提现手续费配置
  private readonly WITHDRAWAL_FEE_RATE = new Decimal(0.01); // 1% 手续费
  private readonly MIN_FEE = new Decimal(1); // 最低 1 USDT

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
    private readonly totpService: TotpService,
  ) {}

  /**
   * 用户申请提现
   * @param userId 用户 ID
   * @param dto 提现申请参数
   */
  async create(
    userId: string,
    dto: CreateWithdrawalDto,
  ): Promise<WithdrawalResponseDto> {
    const { amount, chain, toAddress, totpCode } = dto;

    // 1. 检查用户 2FA 状态
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: {
        two_factor_enabled: true,
        two_factor_secret: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 2. 如果用户开启了 2FA，必须验证
    let twoFactorVerified = false;
    if (user.two_factor_enabled) {
      if (!totpCode) {
        throw new ForbiddenException('请输入 2FA 验证码');
      }

      if (!user.two_factor_secret) {
        throw new BadRequestException('2FA 配置异常，请重新设置');
      }

      // 验证 TOTP 码
      const isValid = this.totpService.verify(totpCode, user.two_factor_secret);
      if (!isValid) {
        throw new ForbiddenException('2FA 验证码错误或已过期');
      }

      twoFactorVerified = true;
      this.logger.log(`用户 ${userId} 2FA 验证通过`);
    }

    // 3. 计算手续费
    const amountDecimal = new Decimal(amount);
    let fee = amountDecimal.times(this.WITHDRAWAL_FEE_RATE);
    if (fee.lt(this.MIN_FEE)) {
      fee = this.MIN_FEE;
    }

    const totalAmount = amountDecimal.plus(fee);

    // 4. 使用事务：检查余额 + 冻结金额 + 创建提现记录
    const withdrawal = await this.prisma.client.$transaction(async (tx) => {
      // 冻结余额（包含手续费）
      await this.walletsService.freezeBalance(
        userId,
        totalAmount.toString(),
        tx,
      );

      // 创建提现记录
      return tx.withdrawals.create({
        data: {
          user_id: userId,
          amount: amountDecimal.toString(),
          currency: 'USDT',
          fee: fee.toString(),
          chain,
          to_address: toAddress,
          status: 'pending',
          two_factor_verified: twoFactorVerified,
        },
      });
    });

    this.logger.log(
      `用户 ${userId} 申请提现 ${amount} USDT，手续费：${fee}，链：${chain}，2FA：${twoFactorVerified ? '已验证' : '未开启'}`,
    );

    return this.toResponseDto(withdrawal);
  }

  /**
   * 查询用户自己的提现记录
   * @param userId 用户 ID
   */
  async findByUserId(userId: string): Promise<WithdrawalResponseDto[]> {
    const withdrawals = await this.prisma.client.withdrawals.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    return withdrawals.map(this.toResponseDto);
  }

  /**
   * 管理员查看所有待审核提现
   */
  async findPending(): Promise<WithdrawalResponseDto[]> {
    const withdrawals = await this.prisma.client.withdrawals.findMany({
      where: { status: 'pending' },
      orderBy: { created_at: 'asc' },
    });

    return withdrawals.map(this.toResponseDto);
  }

  /**
   * 管理员审核通过提现（打款后）
   * @param withdrawalId 提现记录 ID
   * @param adminId 管理员 ID
   * @param txHash 链上交易哈希
   */
  async approve(
    withdrawalId: string,
    adminId: string,
    txHash: string,
  ): Promise<void> {
    const withdrawal = await this.prisma.client.withdrawals.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('提现记录不存在');
    }

    if (withdrawal.status !== 'pending') {
      throw new BadRequestException(`提现记录状态为 ${withdrawal.status}，无法审核`);
    }

    const totalAmount = new Decimal(withdrawal.amount).plus(withdrawal.fee);

    // 使用事务：更新提现状态 + 解冻并扣除余额 + 记录日志
    await this.prisma.client.$transaction(async (tx) => {
      // 1. 更新提现记录状态
      await tx.withdrawals.update({
        where: { id: withdrawalId },
        data: {
          status: 'approved',
          reviewed_by: adminId,
          reviewed_at: new Date(),
          tx_hash: txHash,
        },
      });

      // 2. 解冻并扣除余额
      await this.walletsService.unfreezeAndDeduct(
        withdrawal.user_id,
        totalAmount.toString(),
        tx,
      );

      // 3. 记录计费日志
      await tx.billing_logs.create({
        data: {
          user_id: withdrawal.user_id,
          unique_order_id: `withdrawal_${withdrawal.id}_${Date.now()}`,
          billing_type: 'withdrawal',
          amount: new Decimal(withdrawal.amount).neg(), // 负数表示扣款
          currency: withdrawal.currency,
          reference_type: 'withdrawal',
          reference_id: withdrawal.id,
          description: `提现审核通过：${withdrawal.chain} -> ${withdrawal.to_address}`,
          status: 'completed',
        },
      });

      // 4. 记录手续费
      await tx.billing_logs.create({
        data: {
          user_id: withdrawal.user_id,
          unique_order_id: `withdrawal_fee_${withdrawal.id}_${Date.now()}`,
          billing_type: 'withdrawal_fee',
          amount: new Decimal(withdrawal.fee).neg(),
          currency: withdrawal.currency,
          reference_type: 'withdrawal',
          reference_id: withdrawal.id,
          description: `提现手续费`,
          status: 'completed',
        },
      });

      // 5. 记录审计日志
      await tx.admin_audit_logs.create({
        data: {
          admin_id: adminId,
          action: 'withdrawal_approve',
          target_type: 'withdrawal',
          target_id: withdrawalId,
          details: {
            user_id: withdrawal.user_id,
            amount: withdrawal.amount.toString(),
            fee: withdrawal.fee.toString(),
            currency: withdrawal.currency,
            chain: withdrawal.chain,
            to_address: withdrawal.to_address,
            tx_hash: txHash,
          },
        },
      });
    });

    this.logger.log(
      `管理员 ${adminId} 审核通过提现 ${withdrawalId}，金额：${withdrawal.amount}，txHash：${txHash}`,
    );
  }

  /**
   * 管理员拒绝提现
   * @param withdrawalId 提现记录 ID
   * @param adminId 管理员 ID
   * @param rejectReason 拒绝原因
   */
  async reject(
    withdrawalId: string,
    adminId: string,
    rejectReason: string,
  ): Promise<void> {
    const withdrawal = await this.prisma.client.withdrawals.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('提现记录不存在');
    }

    if (withdrawal.status !== 'pending') {
      throw new BadRequestException(`提现记录状态为 ${withdrawal.status}，无法审核`);
    }

    const totalAmount = new Decimal(withdrawal.amount).plus(withdrawal.fee);

    // 使用事务：更新提现状态 + 解冻余额
    await this.prisma.client.$transaction(async (tx) => {
      // 1. 更新提现记录状态
      await tx.withdrawals.update({
        where: { id: withdrawalId },
        data: {
          status: 'rejected',
          reviewed_by: adminId,
          reviewed_at: new Date(),
          reject_reason: rejectReason,
        },
      });

      // 2. 解冻余额（退回给用户）
      await this.walletsService.unfreezeBalance(
        withdrawal.user_id,
        totalAmount.toString(),
        tx,
      );

      // 3. 记录审计日志
      await tx.admin_audit_logs.create({
        data: {
          admin_id: adminId,
          action: 'withdrawal_reject',
          target_type: 'withdrawal',
          target_id: withdrawalId,
          details: {
            user_id: withdrawal.user_id,
            amount: withdrawal.amount.toString(),
            fee: withdrawal.fee.toString(),
            currency: withdrawal.currency,
            chain: withdrawal.chain,
            to_address: withdrawal.to_address,
            reject_reason: rejectReason,
          },
        },
      });
    });

    this.logger.log(
      `管理员 ${adminId} 拒绝提现 ${withdrawalId}，原因：${rejectReason}`,
    );
  }

  /**
   * 转换为响应 DTO
   */
  private toResponseDto(withdrawal: any): WithdrawalResponseDto {
    return {
      id: withdrawal.id,
      userId: withdrawal.user_id,
      amount: withdrawal.amount.toString(),
      currency: withdrawal.currency,
      fee: withdrawal.fee.toString(),
      chain: withdrawal.chain,
      toAddress: withdrawal.to_address,
      txHash: withdrawal.tx_hash,
      status: withdrawal.status,
      reviewedBy: withdrawal.reviewed_by,
      reviewedAt: withdrawal.reviewed_at,
      rejectReason: withdrawal.reject_reason,
      twoFactorVerified: withdrawal.two_factor_verified,
      createdAt: withdrawal.created_at,
      updatedAt: withdrawal.updated_at,
    };
  }
}
