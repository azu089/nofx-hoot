import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CalculateGasFeeDto, GasFeeResultDto, TodayPnLDto, PnLCurveResponseDto, ChargeSubscriptionDto } from './dto/gas-fee.dto';
import { BillingLogResponseDto } from './dto/billing-log-response.dto';

/**
 * 计费控制器
 * 路由前缀: /api/billing
 */
@ApiTags('计费管理')
@Controller('billing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * 手动触发燃油费计算
   * 处理所有未抽成的盈利交易
   */
  @Post('calculate-gas-fee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '计算燃油费抽成' })
  @ApiResponse({
    status: 200,
    description: '燃油费计算完成',
    type: GasFeeResultDto,
  })
  async calculateGasFee(@Body() dto: CalculateGasFeeDto) {
    const result = await this.billingService.calculateGasFee(
      dto.tradeId,
      dto.instanceId,
    );

    return {
      code: 0,
      message: '燃油费计算完成',
      data: result,
    };
  }

  /**
   * 获取今日盈亏统计
   */
  @Get('today-pnl')
  @ApiOperation({ summary: '获取今日盈亏统计' })
  @ApiResponse({
    status: 200,
    description: '成功获取今日盈亏',
    type: TodayPnLDto,
  })
  async getTodayPnL(@CurrentUser('sub') userId: string) {
    return {
      code: 0,
      message: 'success',
      data: await this.billingService.getTodayPnL(userId),
    };
  }

  /**
   * 获取当月盈亏统计
   */
  @Get('monthly-pnl')
  @ApiOperation({ summary: '获取当月盈亏统计' })
  @ApiResponse({
    status: 200,
    description: '成功获取当月盈亏',
  })
  async getMonthlyPnL(@CurrentUser('sub') userId: string) {
    return {
      code: 0,
      message: 'success',
      data: await this.billingService.getMonthlyPnL(userId),
    };
  }

  /**
   * 获取收益曲线
   */
  @Get('pnl-curve')
  @ApiOperation({ summary: '获取收益曲线' })
  @ApiQuery({ name: 'days', required: false, description: '天数（默认 30）' })
  @ApiResponse({
    status: 200,
    description: '成功获取收益曲线',
    type: PnLCurveResponseDto,
  })
  async getPnLCurve(
    @CurrentUser('sub') userId: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return {
      code: 0,
      message: 'success',
      data: await this.billingService.getPnLCurve(userId, daysNum),
    };
  }

  /**
   * 获取账单统计
   */
  @Get('stats')
  @ApiOperation({ summary: '获取账单统计' })
  @ApiResponse({
    status: 200,
    description: '成功获取账单统计',
  })
  async getStats(@CurrentUser('sub') userId: string) {
    return {
      code: 0,
      message: 'success',
      data: await this.billingService.getStats(userId),
    };
  }

  /**
   * 获取计费日志
   */
  @Get('logs')
  @ApiOperation({ summary: '获取计费日志' })
  @ApiQuery({ name: 'type', required: false, description: '计费类型（gas_fee, subscription）' })
  @ApiQuery({ name: 'limit', required: false, description: '返回条数（默认 50）' })
  @ApiResponse({
    status: 200,
    description: '成功获取计费日志',
    type: [BillingLogResponseDto],
  })
  async getBillingLogs(
    @CurrentUser('sub') userId: string,
    @Query('type') billingType?: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return {
      code: 0,
      message: 'success',
      data: await this.billingService.getBillingLogs(userId, billingType, limitNum),
    };
  }

  /**
   * 获取按实例分组的盈亏统计
   */
  @Get('pnl-by-instance')
  @ApiOperation({ summary: '获取按实例分组的盈亏统计' })
  @ApiResponse({
    status: 200,
    description: '成功获取实例盈亏统计',
  })
  async getPnLByInstance(@CurrentUser('sub') userId: string) {
    return {
      code: 0,
      message: 'success',
      data: await this.billingService.getPnLByInstance(userId),
    };
  }

  /**
   * 获取订阅状态
   */
  @Get('subscription')
  @ApiOperation({ summary: '获取订阅状态' })
  @ApiResponse({
    status: 200,
    description: '成功获取订阅状态',
  })
  async getSubscriptionStatus(@CurrentUser('sub') userId: string) {
    return {
      code: 0,
      message: 'success',
      data: await this.billingService.getSubscriptionStatus(userId),
    };
  }

  /**
   * 订阅扣费（管理员接口）
   * 用于手动扣费或测试
   */
  @Post('charge-subscription')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '订阅扣费' })
  @ApiResponse({
    status: 200,
    description: '扣费成功',
    type: BillingLogResponseDto,
  })
  async chargeSubscription(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChargeSubscriptionDto,
  ) {
    const targetUserId = dto.userId || userId;
    const result = await this.billingService.chargeSubscription(
      targetUserId,
      dto.amount,
      dto.period || '月度订阅',
    );

    return {
      code: 0,
      message: '扣费成功',
      data: result,
    };
  }
}
