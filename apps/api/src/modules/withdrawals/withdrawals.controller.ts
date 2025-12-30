import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ReviewWithdrawalDto } from './dto/withdrawal-response.dto';

/**
 * 提现控制器
 */
@Controller('withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  /**
   * 用户申请提现
   * POST /api/withdrawals
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req: any, @Body() dto: CreateWithdrawalDto) {
    const userId = req.user.sub;
    const withdrawal = await this.withdrawalsService.create(userId, dto);

    return {
      code: 0,
      message: '提现申请已提交，请等待审核',
      data: withdrawal,
    };
  }

  /**
   * 用户查询自己的提现记录
   * GET /api/withdrawals
   */
  @Get()
  async findMine(@Request() req: any) {
    const userId = req.user.sub;
    const withdrawals = await this.withdrawalsService.findByUserId(userId);

    return {
      code: 0,
      message: 'success',
      data: withdrawals,
    };
  }

  /**
   * 管理员查看所有待审核提现
   * GET /api/admin/withdrawals
   */
  @Get('admin')
  async findPending() {
    const withdrawals = await this.withdrawalsService.findPending();

    return {
      code: 0,
      message: 'success',
      data: withdrawals,
    };
  }

  /**
   * 管理员审核提现
   * POST /api/admin/withdrawals/:id/review
   */
  @Post('admin/:id/review')
  @HttpCode(HttpStatus.OK)
  async review(
    @Request() req: any,
    @Param('id') withdrawalId: string,
    @Body() dto: ReviewWithdrawalDto,
  ) {
    const adminId = req.user.sub;

    if (dto.status === 'approved') {
      if (!dto.txHash) {
        throw new BadRequestException('审核通过时必须填写交易哈希 txHash');
      }
      await this.withdrawalsService.approve(withdrawalId, adminId, dto.txHash);
    } else {
      await this.withdrawalsService.reject(
        withdrawalId,
        adminId,
        dto.rejectReason || '未通过审核',
      );
    }

    return {
      code: 0,
      message: `提现已${dto.status === 'approved' ? '通过' : '拒绝'}`,
      data: null,
    };
  }
}
