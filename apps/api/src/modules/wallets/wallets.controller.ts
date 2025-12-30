import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { PurchaseCardDto } from './dto/wallet-response.dto';

/**
 * 钱包控制器
 * 路由前缀: /api/wallets
 */
@ApiTags('钱包管理')
@Controller('wallets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 获取当前用户钱包信息
   * GET /api/wallets/me
   */
  @Get('me')
  @ApiOperation({ summary: '获取钱包信息' })
  async getMyWallet(@CurrentUser() user: JwtPayload) {
    return {
      code: 0,
      message: 'success',
      data: await this.walletsService.findByUserId(user.sub),
    };
  }

  /**
   * 获取当前用户余额概览
   * GET /api/wallets/balance
   */
  @Get('balance')
  @ApiOperation({ summary: '获取余额概览' })
  async getBalance(@CurrentUser() user: JwtPayload) {
    return {
      code: 0,
      message: 'success',
      data: await this.walletsService.getBalance(user.sub),
    };
  }

  /**
   * 获取交易记录
   * GET /api/wallets/transactions
   */
  @Get('transactions')
  @ApiOperation({ summary: '获取交易记录' })
  @ApiQuery({ name: 'type', required: false, description: '交易类型 (deposit/withdraw/transfer)' })
  @ApiQuery({ name: 'limit', required: false, description: '每页条数' })
  @ApiQuery({ name: 'offset', required: false, description: '偏移量' })
  async getTransactions(
    @CurrentUser() user: JwtPayload,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = parseInt(limit || '20', 10);
    const skip = parseInt(offset || '0', 10);

    // 查询充值记录
    const deposits = await this.prisma.client.deposits.findMany({
      where: {
        user_id: user.sub,
        ...(type === 'deposit' ? {} : type ? { id: 'none' } : {}),
      },
      orderBy: { created_at: 'desc' },
      take,
      skip,
    });

    // 查询提现记录
    const withdrawals = await this.prisma.client.withdrawals.findMany({
      where: {
        user_id: user.sub,
        ...(type === 'withdraw' ? {} : type ? { id: 'none' } : {}),
      },
      orderBy: { created_at: 'desc' },
      take,
      skip,
    });

    // 合并并排序
    const transactions = [
      ...deposits.map((d) => ({
        id: d.id,
        type: 'deposit' as const,
        amount: d.amount.toString(),
        status: d.status,
        chain: d.chain,
        txHash: d.tx_hash,
        createdAt: d.created_at,
      })),
      ...withdrawals.map((w) => ({
        id: w.id,
        type: 'withdraw' as const,
        amount: w.amount.toString(),
        status: w.status,
        chain: w.chain,
        toAddress: w.to_address,
        txHash: w.tx_hash,
        createdAt: w.created_at,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      code: 0,
      message: 'success',
      data: {
        transactions: transactions.slice(0, take),
        total: deposits.length + withdrawals.length,
      },
    };
  }

  /**
   * 购买点卡（USDT → 点卡）
   * POST /api/wallets/purchase-card
   *
   * 点卡用于支付燃油费（盈利抽成 20%）
   */
  @Post('purchase-card')
  @ApiOperation({ summary: '购买点卡', description: '使用 USDT 购买点卡，点卡用于支付燃油费' })
  @ApiBody({ type: PurchaseCardDto })
  async purchaseCard(
    @CurrentUser() user: JwtPayload,
    @Body() dto: PurchaseCardDto,
  ) {
    const result = await this.walletsService.purchaseCard(user.sub, dto.amount);
    return {
      code: 0,
      message: '点卡购买成功',
      data: result,
    };
  }
}
