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
import { FreqtradeService } from '../freqtrade/freqtrade.service';

/**
 * VPS 实例控制器
 * 路由前缀: /api/instances
 *
 * 核心规则（白皮书 2.1）：
 * - 用户只能查看 VPS 状态
 * - VPS 创建由订阅购买自动触发
 * - VPS 销毁由订阅到期自动触发
 * - 用户不能手动创建/销毁 VPS
 */
@Controller('instances')
@UseGuards(JwtAuthGuard)
export class InstancesController {
  constructor(
    private readonly instancesService: InstancesService,
    private readonly freqtradeService: FreqtradeService,
  ) {}

  /**
   * 购买订阅（唯一入口）
   * 流程：扣费 → 更新订阅 → 自动创建 VPS
   * POST /api/instances/subscribe
   */
  @Post('subscribe')
  async purchaseSubscription(
    @CurrentUser() user: JwtPayload,
    @Body() body: { usePoints?: boolean; region?: string },
  ) {
    const result = await this.instancesService.purchaseSubscription(
      user.sub,
      body.usePoints !== false,
      body.region || 'sgp1',
    );
    return {
      code: 0,
      message: '订阅成功，VPS 已自动创建',
      data: result,
    };
  }

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

  // 注意：移除了用户手动创建/销毁 VPS 的接口
  // VPS 生命周期完全由订阅状态控制

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

  // 已移除：destroy, start, stop, restart, force-exit 接口
  // 用户不能手动操作 VPS，只能查看状态

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
   * 获取实例运行状态（Freqtrade）- 只读
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
   * 获取实例余额（Freqtrade）- 只读
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
   * 获取实例交易（Freqtrade）- 只读
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
   * 下载历史 K 线数据
   * POST /api/instances/:id/download-kline
   *
   * 回测前需要先下载历史 K 线数据到 VPS
   * 通过 Freqtrade 的 download-data 命令实现
   */
  @Post(':id/download-kline')
  async downloadKlineData(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body()
    dto: {
      pairs: string[];
      timeframes: string[];
      startDate?: string;
      exchange?: string;
    },
  ) {
    // 验证实例归属
    const instance = await this.instancesService.findById(id, user.sub);
    if (!instance) {
      return {
        code: 404,
        message: '实例不存在',
        data: null,
      };
    }

    if (instance.status !== 'running') {
      return {
        code: 400,
        message: '实例未运行，请先启动实例',
        data: null,
      };
    }

    if (!instance.ip_address) {
      return {
        code: 400,
        message: '实例 IP 地址尚未分配',
        data: null,
      };
    }

    // 调用 FreqtradeService 下载 K 线
    const result = await this.freqtradeService.downloadKlineData(
      instance.ip_address,
      {
        exchange: dto.exchange || 'binance',
        pairs: dto.pairs || ['BTC/USDT', 'ETH/USDT'],
        timeframes: dto.timeframes || ['1h', '4h', '1d'],
        startDate: dto.startDate,
      },
    );

    return {
      code: 0,
      message: result.message,
      data: {
        status: result.status,
        taskId: result.taskId,
      },
    };
  }

  /**
   * 获取 K 线下载状态
   * GET /api/instances/:id/kline-status
   *
   * 检查 K 线数据下载进度和可用数据
   */
  @Get(':id/kline-status')
  async getKlineStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Query('taskId') taskId?: string,
  ) {
    // 验证实例归属
    const instance = await this.instancesService.findById(id, user.sub);
    if (!instance) {
      return {
        code: 404,
        message: '实例不存在',
        data: null,
      };
    }

    if (!instance.ip_address) {
      return {
        code: 400,
        message: '实例 IP 地址尚未分配',
        data: null,
      };
    }

    // 获取下载状态
    const status = await this.freqtradeService.getKlineDownloadStatus(
      instance.ip_address,
      taskId,
    );

    return {
      code: 0,
      message: 'success',
      data: status,
    };
  }

  /**
   * 获取已下载的 K 线数据信息
   * GET /api/instances/:id/kline-data
   *
   * 返回 VPS 上可用的 K 线数据列表
   */
  @Get(':id/kline-data')
  async getAvailableKlineData(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // 验证实例归属
    const instance = await this.instancesService.findById(id, user.sub);
    if (!instance) {
      return {
        code: 404,
        message: '实例不存在',
        data: null,
      };
    }

    if (!instance.ip_address) {
      return {
        code: 400,
        message: '实例 IP 地址尚未分配',
        data: null,
      };
    }

    // 获取可用数据
    const data = await this.freqtradeService.getAvailableKlineData(
      instance.ip_address,
    );

    return {
      code: 0,
      message: 'success',
      data,
    };
  }
}
