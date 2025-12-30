import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { InstancesService } from './instances.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { CreateInstanceDto, HeartbeatDto } from './dto/instance-response.dto';
import { Public } from '../../common/decorators/public.decorator';

/**
 * VPS 实例控制器
 * 路由前缀: /api/instances
 */
@Controller('instances')
@UseGuards(JwtAuthGuard)
export class InstancesController {
  constructor(private readonly instancesService: InstancesService) {}

  /**
   * 一键清仓（Panic Sell）
   * 清空用户所有运行中实例的所有持仓
   * POST /api/instances/panic-sell
   *
   * 注意：此路由必须放在 :id 路由之前，避免被 :id 匹配
   */
  @Post('panic-sell')
  async panicSell(@CurrentUser() user: JwtPayload) {
    const result = await this.instancesService.panicSell(user.sub);
    return {
      code: 0,
      message: '一键清仓已执行',
      data: result,
    };
  }

  /**
   * 创建 VPS 实例
   * POST /api/instances
   */
  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateInstanceDto,
  ) {
    return this.instancesService.create(user.sub, dto);
  }

  /**
   * 获取当前用户的所有实例
   * GET /api/instances
   */
  @Get()
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.instancesService.findAllByUserId(user.sub);
  }

  /**
   * 获取实例详情
   * GET /api/instances/:id
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.instancesService.findById(id, user.sub);
  }

  /**
   * 销毁实例
   * DELETE /api/instances/:id
   */
  @Delete(':id')
  async destroy(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Query('reason') reason?: string,
  ) {
    return this.instancesService.destroy(id, user.sub, reason || '用户主动销毁');
  }

  /**
   * 心跳上报（VPS 调用，无需用户认证）
   * POST /api/instances/:id/heartbeat
   */
  @Public()
  @Post(':id/heartbeat')
  async heartbeat(
    @Param('id') id: string,
    @Body() dto: HeartbeatDto,
  ) {
    return this.instancesService.heartbeat(id, dto);
  }

  /**
   * 启动策略
   * POST /api/instances/:id/start
   */
  @Post(':id/start')
  async startStrategy(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.instancesService.startStrategy(id, user.sub);
  }

  /**
   * 停止策略
   * POST /api/instances/:id/stop
   */
  @Post(':id/stop')
  async stopStrategy(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.instancesService.stopStrategy(id, user.sub);
  }

  /**
   * 重启实例
   * POST /api/instances/:id/restart
   */
  @Post(':id/restart')
  async restart(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.instancesService.restart(id, user.sub);
  }

  /**
   * 手动同步状态
   * POST /api/instances/:id/sync
   */
  @Post(':id/sync')
  async syncStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.instancesService.syncStatus(id, user.sub);
  }

  /**
   * 获取实例运行状态（Freqtrade）
   * GET /api/instances/:id/status
   */
  @Get(':id/status')
  async getFreqtradeStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.instancesService.getFreqtradeStatus(id, user.sub);
  }

  /**
   * 获取实例余额（Freqtrade）
   * GET /api/instances/:id/balance
   */
  @Get(':id/balance')
  async getFreqtradeBalance(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.instancesService.getFreqtradeBalance(id, user.sub);
  }

  /**
   * 获取实例交易（Freqtrade）
   * GET /api/instances/:id/trades
   */
  @Get(':id/trades')
  async getFreqtradeTrades(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.instancesService.getFreqtradeTrades(id, user.sub);
  }

  /**
   * 紧急平仓（单个交易）
   * POST /api/instances/:id/force-exit
   */
  @Post(':id/force-exit')
  async forceExit(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { trade_id?: string },
  ) {
    return this.instancesService.forceExit(id, user.sub, body.trade_id);
  }
}
