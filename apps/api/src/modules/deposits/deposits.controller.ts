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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { DepositsService } from './deposits.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { ReviewDepositDto } from './dto/deposit-response.dto';

/**
 * 充值控制器
 */
@Controller('deposits')
@UseGuards(JwtAuthGuard)
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  /**
   * 用户申请充值
   * POST /api/deposits
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req: any, @Body() dto: CreateDepositDto) {
    const userId = req.user.sub;
    const deposit = await this.depositsService.create(userId, dto);

    return {
      code: 0,
      message: '充值申请已提交，请等待审核',
      data: deposit,
    };
  }

  /**
   * 用户查询自己的充值记录
   * GET /api/deposits
   */
  @Get()
  async findMine(@Request() req: any) {
    const userId = req.user.sub;
    const deposits = await this.depositsService.findByUserId(userId);

    return {
      code: 0,
      message: 'success',
      data: deposits,
    };
  }

  /**
   * 管理员查看所有待审核充值
   * GET /api/deposits/admin
   */
  @Get('admin')
  @UseGuards(AdminGuard)
  async findPending() {
    const deposits = await this.depositsService.findPending();

    return {
      code: 0,
      message: 'success',
      data: deposits,
    };
  }

  /**
   * 管理员审核充值
   * POST /api/deposits/admin/:id/review
   */
  @Post('admin/:id/review')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  async review(
    @Request() req: any,
    @Param('id') depositId: string,
    @Body() dto: ReviewDepositDto,
  ) {
    const adminId = req.user.sub;

    if (dto.status === 'approved') {
      await this.depositsService.approve(depositId, adminId);
    } else {
      await this.depositsService.reject(
        depositId,
        adminId,
        dto.rejectReason || '未通过审核',
      );
    }

    return {
      code: 0,
      message: `充值已${dto.status === 'approved' ? '通过' : '拒绝'}`,
      data: null,
    };
  }
}
