import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { InstancesService } from './instances.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { CreateInstanceDto, HeartbeatDto } from './dto/instance-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { FreqtradeService } from '../freqtrade/freqtrade.service';
import { NetworkWhitelistService } from '../../common/services/network-whitelist.service';

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
    private readonly networkWhitelistService: NetworkWhitelistService,
  ) {}

  /**
   * 购买订阅（唯一入口）
   * 流程：扣费 → 更新订阅 → 自动创建 VPS
   * POST /api/instances/subscribe
   *
   * 注意：订阅只支持 USDT 支付，不支持积分抵扣
   */
  @Post('subscribe')
  async purchaseSubscription(
    @CurrentUser() user: JwtPayload,
    @Body() body: { region?: string },
  ) {
    const result = await this.instancesService.purchaseSubscription(
      user.sub,
      body.region || 'fra1',
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

  /**
   * 手动创建 VPS（需要有效订阅）
   * POST /api/instances/create
   *
   * 限制：一个订阅账号只能创建 1 个 VPS
   */
  @Post('create')
  async createVps(
    @CurrentUser() user: JwtPayload,
    @Body() body: { region?: string },
  ) {
    try {
      const instance = await this.instancesService.createVps(
        user.sub,
        body.region || 'fra1',
      );
      return {
        code: 0,
        message: 'VPS 创建中，请等待 5-8 分钟',
        data: instance,
      };
    } catch (error) {
      return {
        code: 40001,
        message: error.message || 'VPS 创建失败',
        data: null,
      };
    }
  }

  /**
   * 手动销毁 VPS
   * POST /api/instances/:id/destroy
   */
  @Post(':id/destroy')
  async destroyVps(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.instancesService.destroyVps(id, user.sub);
      return {
        code: 0,
        message: 'VPS 已销毁',
        data: result,
      };
    } catch (error) {
      return {
        code: 40001,
        message: error.message || 'VPS 销毁失败',
        data: null,
      };
    }
  }

  /**
   * 获取当前用户的所有实例
   * GET /api/instances
   */
  @Get()
  async findAll(@CurrentUser() user: JwtPayload) {
    try {
      const instances = await this.instancesService.findAllByUserId(user.sub);
      return {
        code: 0,
        message: 'success',
        data: instances,
      };
    } catch (error) {
      return {
        code: 50001,
        message: error.message || '获取实例列表失败',
        data: [],
      };
    }
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
    try {
      const instance = await this.instancesService.findById(id, user.sub);
      return {
        code: 0,
        message: 'success',
        data: instance,
      };
    } catch (error) {
      return {
        code: 40401,
        message: error.message || '实例不存在',
        data: null,
      };
    }
  }

  // 已移除：destroy, start, stop, restart, force-exit 接口
  // 用户不能手动操作 VPS，只能查看状态

  /**
   * 硬重启 VPS（用于僵尸节点恢复）
   * POST /api/instances/:id/reboot
   *
   * 通过 DigitalOcean API 强制重启 Droplet
   */
  @Post(':id/reboot')
  async rebootInstance(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    try {
      const result = await this.instancesService.rebootInstance(id, user.sub);
      return {
        code: 0,
        message: 'VPS 重启指令已发送',
        data: result,
      };
    } catch (error) {
      return {
        code: 40001,
        message: error.message || 'VPS 重启失败',
        data: null,
      };
    }
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
   * VPS 初始化完成回调（VPS 调用，无需用户认证）
   * POST /api/instances/:id/ready
   *
   * VPS 初始化脚本在所有服务就绪后调用此接口
   * 用于立即更新实例状态为 running，无需等待心跳同步
   */
  @Public()
  @Post(':id/ready')
  @HttpCode(200)
  async markAsReady(
    @Param('id') id: string,
    @Headers('x-instance-token') instanceToken: string,
    @Body()
    dto: {
      status: string;
      freqtradeStatus?: string;
      proxyStatus?: string;
    },
  ) {
    return this.instancesService.markAsReady(id, instanceToken, dto);
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
    try {
      const data = await this.instancesService.getFreqtradeStatus(id, user.sub);
      return { code: 0, message: 'success', data };
    } catch (error) {
      return {
        code: 40901,
        message: error.message || '获取实例状态失败',
        data: null,
      };
    }
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
    try {
      const data = await this.instancesService.getFreqtradeBalance(id, user.sub);
      return { code: 0, message: 'success', data };
    } catch (error) {
      return {
        code: 40901,
        message: error.message || '获取实例余额失败',
        data: null,
      };
    }
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
    try {
      const data = await this.instancesService.getFreqtradeTrades(id, user.sub);
      return { code: 0, message: 'success', data };
    } catch (error) {
      return {
        code: 40901,
        message: error.message || '获取实例交易失败',
        data: [],
      };
    }
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
    const apiToken = this.networkWhitelistService.generateFreqtradeToken(instance.id);
    const result = await this.freqtradeService.downloadKlineData(
      instance.ip_address,
      {
        exchange: dto.exchange || 'binance',
        pairs: dto.pairs || ['BTC/USDT', 'ETH/USDT'],
        timeframes: dto.timeframes || ['1h', '4h', '1d'],
        startDate: dto.startDate,
      },
      apiToken,
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
    const apiToken = this.networkWhitelistService.generateFreqtradeToken(instance.id);
    const status = await this.freqtradeService.getKlineDownloadStatus(
      instance.ip_address,
      taskId,
      apiToken,
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
    const apiToken = this.networkWhitelistService.generateFreqtradeToken(instance.id);
    const data = await this.freqtradeService.getAvailableKlineData(
      instance.ip_address,
      apiToken,
    );

    return {
      code: 0,
      message: 'success',
      data,
    };
  }
}
