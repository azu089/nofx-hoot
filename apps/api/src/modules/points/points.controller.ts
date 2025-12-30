import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PointsService } from './points.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PointsBalanceDto,
  PointsHistoryDto,
  PointsHistoryListDto,
} from './dto/points-response.dto';
import { DeductPointsDto } from './dto/deduct-points.dto';

/**
 * 积分控制器
 * 处理积分相关的 HTTP 请求
 *
 * 路由：/api/points
 */
@ApiTags('积分管理')
@Controller('points')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PointsController {
  private readonly logger = new Logger(PointsController.name);

  constructor(private readonly pointsService: PointsService) {}

  /**
   * 查询积分余额
   * GET /api/points/balance
   */
  @Get('balance')
  @ApiOperation({ summary: '查询积分余额' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: PointsBalanceDto,
  })
  async getBalance(@Request() req: any) {
    const userId = req.user.userId;
    this.logger.log(`用户 ${userId} 查询积分余额`);

    const balance = await this.pointsService.getBalance(userId);

    return {
      code: 0,
      message: 'success',
      data: balance,
    };
  }

  /**
   * 查询积分流水
   * GET /api/points/history
   */
  @Get('history')
  @ApiOperation({ summary: '查询积分流水' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: PointsHistoryListDto,
  })
  async getHistory(
    @Request() req: any,
    @Query('limit') limit: string = '50',
  ) {
    const userId = req.user.userId;
    const limitNum = parseInt(limit, 10) || 50;

    this.logger.log(`用户 ${userId} 查询积分流水，限制 ${limitNum} 条`);

    const history = await this.pointsService.getHistory(userId, limitNum);

    return {
      code: 0,
      message: 'success',
      data: {
        history,
        total: history.length,
      },
    };
  }

  /**
   * 抵扣积分（管理员接口）
   * POST /api/points/deduct
   *
   * 注意：此接口应该添加管理员权限验证
   * 目前暂时开放给所有认证用户（后续需要添加 AdminGuard）
   */
  @Post('deduct')
  @ApiOperation({ summary: '抵扣积分（管理员）' })
  @ApiResponse({
    status: 200,
    description: '抵扣成功',
  })
  async deductPoints(@Body() dto: DeductPointsDto) {
    this.logger.log(`管理员抵扣用户 ${dto.userId} 的 ${dto.points} 积分`);

    const deductedPoints = await this.pointsService.deductForSubscription(
      dto.userId,
      dto.points,
      dto.description,
    );

    return {
      code: 0,
      message: 'success',
      data: {
        deductedPoints,
      },
    };
  }
}
