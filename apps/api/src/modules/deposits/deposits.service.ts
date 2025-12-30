import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { DepositResponseDto } from './dto/deposit-response.dto';
import Decimal from 'decimal.js';

/**
 * 充值服务
 * 处理充值申请、审核等业务逻辑
 */
@Injectable()
export class DepositsService {
  private readonly logger = new Logger(DepositsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletsService: WalletsService,
  ) {}

  /**
   * 用户申请充值
   * @param userId 用户 ID
   * @param dto 充值申请参数
   */
  async create(
    userId: string,
    dto: CreateDepositDto,
  ): Promise<DepositResponseDto> {
    const { amount, method, proofImageUrl, chain, fromAddress, txHash } = dto;

    // 创建充值记录
    const deposit = await this.prisma.client.deposits.create({
      data: {
        user_id: userId,
        amount: new Decimal(amount).toString(),
        currency: 'USDT',
        method,
        chain,
        from_address: fromAddress,
        tx_hash: txHash,
        proof_image_url: proofImageUrl,
        status: 'pending',
      },
    });

    this.logger.log(`用户 ${userId} 申请充值 ${amount} USDT，方式：${method}`);

    return this.toResponseDto(deposit);
  }

  /**
   * 查询用户自己的充值记录
   * @param userId 用户 ID
   */
  async findByUserId(userId: string): Promise<DepositResponseDto[]> {
    const deposits = await this.prisma.client.deposits.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    return deposits.map(this.toResponseDto);
  }

  /**
   * 管理员查看所有待审核充值
   */
  async findPending(): Promise<DepositResponseDto[]> {
    const deposits = await this.prisma.client.deposits.findMany({
      where: { status: 'pending' },
      orderBy: { created_at: 'asc' },
    });

    return deposits.map(this.toResponseDto);
  }

  /**
   * 管理员审核通过充值
   * @param depositId 充值记录 ID
   * @param adminId 管理员 ID
   */
  async approve(depositId: string, adminId: string): Promise<void> {
    const deposit = await this.prisma.client.deposits.findUnique({
      where: { id: depositId },
    });

    if (!deposit) {
      throw new NotFoundException('充值记录不存在');
    }

    if (deposit.status !== 'pending') {
      throw new BadRequestException(`充值记录状态为 ${deposit.status}，无法审核`);
    }

    // 使用事务：更新充值状态 + 增加用户余额
    await this.prisma.client.$transaction(async (tx) => {
      // 1. 更新充值记录状态
      await tx.deposits.update({
        where: { id: depositId },
        data: {
          status: 'approved',
          reviewed_by: adminId,
          reviewed_at: new Date(),
        },
      });

      // 2. 增加用户余额
      await this.walletsService.increaseBalance(
        deposit.user_id,
        deposit.amount.toString(),
        tx,
      );

      // 3. 记录计费日志
      await tx.billing_logs.create({
        data: {
          user_id: deposit.user_id,
          unique_order_id: `deposit_${deposit.id}_${Date.now()}`,
          billing_type: 'deposit',
          amount: deposit.amount,
          currency: deposit.currency,
          reference_type: 'deposit',
          reference_id: deposit.id,
          description: `充值审核通过：${deposit.method}`,
          status: 'completed',
        },
      });
    });

    this.logger.log(
      `管理员 ${adminId} 审核通过充值 ${depositId}，金额：${deposit.amount}`,
    );
  }

  /**
   * 管理员拒绝充值
   * @param depositId 充值记录 ID
   * @param adminId 管理员 ID
   * @param rejectReason 拒绝原因
   */
  async reject(
    depositId: string,
    adminId: string,
    rejectReason: string,
  ): Promise<void> {
    const deposit = await this.prisma.client.deposits.findUnique({
      where: { id: depositId },
    });

    if (!deposit) {
      throw new NotFoundException('充值记录不存在');
    }

    if (deposit.status !== 'pending') {
      throw new BadRequestException(`充值记录状态为 ${deposit.status}，无法审核`);
    }

    // 更新充值记录状态
    await this.prisma.client.deposits.update({
      where: { id: depositId },
      data: {
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: new Date(),
        reject_reason: rejectReason,
      },
    });

    this.logger.log(
      `管理员 ${adminId} 拒绝充值 ${depositId}，原因：${rejectReason}`,
    );
  }

  /**
   * 转换为响应 DTO
   */
  private toResponseDto(deposit: any): DepositResponseDto {
    return {
      id: deposit.id,
      userId: deposit.user_id,
      amount: deposit.amount.toString(),
      currency: deposit.currency,
      method: deposit.method,
      chain: deposit.chain,
      fromAddress: deposit.from_address,
      txHash: deposit.tx_hash,
      blockNumber: deposit.block_number?.toString(),
      confirmations: deposit.confirmations,
      proofImageUrl: deposit.proof_image_url,
      reviewedBy: deposit.reviewed_by,
      reviewedAt: deposit.reviewed_at,
      status: deposit.status,
      rejectReason: deposit.reject_reason,
      createdAt: deposit.created_at,
      updatedAt: deposit.updated_at,
    };
  }
}
