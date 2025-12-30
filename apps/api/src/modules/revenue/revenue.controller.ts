import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { RevenueService } from './revenue.service';

/**
 * 收入分配控制器
 *
 * 路由：
 * - GET  /api/revenue/current - 当前周期收入
 * - GET  /api/revenue/history - 分配历史
 * - POST /api/revenue/distribute - 执行分配（管理员）
 * - GET  /api/revenue/stats - 统计数据
 */
@Controller('revenue')
export class RevenueController {
  private readonly logger = new Logger(RevenueController.name);

  constructor(private readonly revenueService: RevenueService) {}

  /**
   * 获取当前周期收入
   * GET /api/revenue/current
   */
  @Get('current')
  async getCurrentPeriod() {
    try {
      const data = await this.revenueService.getCurrentPeriod();

      return {
        code: 0,
        message: 'success',
        data,
      };
    } catch (error) {
      this.logger.error(`获取当前周期失败: ${error.message}`, error.stack);
      return {
        code: 50001,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * 获取今日收入
   * GET /api/revenue/today
   */
  @Get('today')
  async getTodayRevenue() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 使用当前周期数据，过滤今日
      const data = await this.revenueService.getCurrentPeriod();

      return {
        code: 0,
        message: 'success',
        data: {
          date: today.toISOString().split('T')[0],
          ...data,
        },
      };
    } catch (error) {
      this.logger.error(`获取今日收入失败: ${error.message}`, error.stack);
      return {
        code: 50001,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * 获取分配历史
   * GET /api/revenue/history?page=1&limit=10&status=completed
   */
  @Get('history')
  async getHistory(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('status') status?: 'pending' | 'processing' | 'completed',
  ) {
    try {
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;

      const data = await this.revenueService.getDistributionHistory(
        pageNum,
        limitNum,
        status,
      );

      return {
        code: 0,
        message: 'success',
        data,
      };
    } catch (error) {
      this.logger.error(`获取分配历史失败: ${error.message}`, error.stack);
      return {
        code: 50001,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * 执行收入分配（管理员）
   * POST /api/revenue/distribute
   * Body: { periodStart: '2024-01-01', periodEnd: '2024-02-01' }
   */
  @Post('distribute')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(AdminGuard) // TODO: 添加管理员权限守卫
  async distribute(
    @Body('periodStart') periodStart: string,
    @Body('periodEnd') periodEnd: string,
  ) {
    try {
      // 参数校验
      if (!periodStart || !periodEnd) {
        return {
          code: 40001,
          message: '参数错误：periodStart 和 periodEnd 不能为空',
          data: null,
        };
      }

      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return {
          code: 40001,
          message: '参数错误：日期格式不正确',
          data: null,
        };
      }

      if (startDate >= endDate) {
        return {
          code: 40001,
          message: '参数错误：开始日期必须早于结束日期',
          data: null,
        };
      }

      // 执行分配
      const distribution = await this.revenueService.distribute(
        startDate,
        endDate,
      );

      this.logger.log(`收入分配成功: ${distribution.id}`);

      return {
        code: 0,
        message: '分配成功',
        data: distribution,
      };
    } catch (error) {
      this.logger.error(`收入分配失败: ${error.message}`, error.stack);
      return {
        code: 50001,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * 获取统计数据
   * GET /api/revenue/stats
   */
  @Get('stats')
  async getStats() {
    try {
      const data = await this.revenueService.getStats();

      return {
        code: 0,
        message: 'success',
        data,
      };
    } catch (error) {
      this.logger.error(`获取统计数据失败: ${error.message}`, error.stack);
      return {
        code: 50001,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * 模拟回购（沙盒测试）
   * POST /api/revenue/simulate-buyback
   * Body: { amount: '1000.00' }
   */
  @Post('simulate-buyback')
  @HttpCode(HttpStatus.OK)
  async simulateBuyback(@Body('amount') amount: string) {
    try {
      if (!amount) {
        return {
          code: 40001,
          message: '参数错误：amount 不能为空',
          data: null,
        };
      }

      const result = await this.revenueService.simulateBuyback(amount);

      return {
        code: 0,
        message: '模拟成功',
        data: result,
      };
    } catch (error) {
      this.logger.error(`模拟回购失败: ${error.message}`, error.stack);
      return {
        code: 50001,
        message: error.message,
        data: null,
      };
    }
  }
}
