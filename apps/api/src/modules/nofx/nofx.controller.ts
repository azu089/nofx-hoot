import {
  BadGatewayException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NofxClient } from './nofx.client';
import { NofxService, NofxUpstreamError, NofxUnreachableError } from './nofx.service';
import { MembershipGateGuard } from './membership-gate.guard';

/**
 * NofxController —— HOOT 商业核心暴露给前端的 nofx 代理路由集。
 *
 * 路由分类：
 * - 公共冒烟（@Public）：GET /api/nofx/health  仅做链路探测
 * - 用户级（默认全局 JwtAuthGuard 拦截）：所有 /api/nofx/traders/* 系列
 *
 * 安全门禁（铁律）：
 * - userId 只能从 @CurrentUser('id') 取，禁止从 query/header/body 读取
 * - 所有 upstream 调用走 NofxService.proxyGet，禁止 controller 直接 new NofxClient.get
 * - traderId 是用户输入，越权访问由 nofx 端按 user_id 隔离做兜底（双重防御）
 *
 * 响应格式遵循 HOOT 全局约定 { code, message, data }，requestId 由全局
 * TransformInterceptor 自动注入。错误码段：
 * - 50201 nofx 不可达
 * - 50202 nofx 未配置
 * - 50203 nofx 上游错误（透传 status + message）
 */
@Controller('nofx')
export class NofxController {
  private readonly logger = new Logger(NofxController.name);

  constructor(
    private readonly client: NofxClient,
    private readonly service: NofxService,
  ) {}

  // ==========================================================================
  // 冒烟接口
  // ==========================================================================

  @Public()
  @Get('health')
  async health() {
    if (!this.client.isConfigured) {
      return {
        code: 50202,
        message: 'nofx not configured',
        data: { ok: false, error: 'NOFX_INTERNAL_TOKEN missing' },
      };
    }
    try {
      const resp = await this.client.get<unknown>('/api/health');
      return {
        code: 0,
        message: 'success',
        data: { ok: true, upstream: resp.data },
      };
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = (err as Error)?.message ?? 'unknown error';
      this.logger.warn(`[nofx] health probe failed status=${status ?? 'NET'} msg=${msg}`);
      return {
        code: 50201,
        message: 'nofx unreachable',
        data: { ok: false, error: msg, upstream_status: status ?? null },
      };
    }
  }

  // ==========================================================================
  // 用户级只读路由（默认走全局 JwtAuthGuard）
  // ==========================================================================

  /** 当前用户的所有 trader 列表。 */
  @Get('traders')
  async listTraders(@CurrentUser('id') userId: string) {
    return this.wrap(() => this.service.listTraders(userId));
  }

  /** 单个 trader 运行状态。 */
  @Get('traders/:traderId/status')
  async getTraderStatus(
    @CurrentUser('id') userId: string,
    @Param('traderId') traderId: string,
  ) {
    return this.wrap(() => this.service.getTraderStatus(userId, traderId));
  }

  /** 单个 trader 账户/权益快照。 */
  @Get('traders/:traderId/account')
  async getTraderAccount(
    @CurrentUser('id') userId: string,
    @Param('traderId') traderId: string,
  ) {
    return this.wrap(() => this.service.getTraderAccount(userId, traderId));
  }

  /** 单个 trader 当前持仓。 */
  @Get('traders/:traderId/positions')
  async getTraderPositions(
    @CurrentUser('id') userId: string,
    @Param('traderId') traderId: string,
  ) {
    return this.wrap(() => this.service.getTraderPositions(userId, traderId));
  }

  /** 单个 trader 各 symbol 最新决策。 */
  @Get('traders/:traderId/decisions/latest')
  async getLatestDecisions(
    @CurrentUser('id') userId: string,
    @Param('traderId') traderId: string,
  ) {
    return this.wrap(() => this.service.getLatestDecisions(userId, traderId));
  }

  /** 单个 trader 权益曲线历史。 */
  @Get('traders/:traderId/equity-history')
  async getEquityHistory(
    @CurrentUser('id') userId: string,
    @Param('traderId') traderId: string,
    @Query('range') range?: string,
  ) {
    return this.wrap(() => this.service.getEquityHistory(userId, traderId, range));
  }

  /** 单个 trader 统计指标（胜率、总单、总盈亏等）。 */
  @Get('traders/:traderId/statistics')
  async getTraderStatistics(
    @CurrentUser('id') userId: string,
    @Param('traderId') traderId: string,
  ) {
    return this.wrap(() => this.service.getTraderStatistics(userId, traderId));
  }

  /** 当前用户的策略列表。 */
  @Get('strategies')
  async listStrategies(@CurrentUser('id') userId: string) {
    return this.wrap(() => this.service.listStrategies(userId));
  }

  /** 当前用户配置的 AI 模型列表。 */
  @Get('models')
  async listAiModels(@CurrentUser('id') userId: string) {
    return this.wrap(() => this.service.listAiModels(userId));
  }

  /** 当前用户配置的交易所账户列表。 */
  @Get('exchanges')
  async listExchanges(@CurrentUser('id') userId: string) {
    return this.wrap(() => this.service.listExchanges(userId));
  }

  // ==========================================================================
  // 写操作（P6b-2）— 挂 MembershipGateGuard，只有活跃订阅用户能执行
  // ==========================================================================

  /** 创建新 trader。 */
  @UseGuards(MembershipGateGuard)
  @Post('traders')
  async createTrader(
    @CurrentUser('id') userId: string,
    @Body() body: unknown,
  ) {
    return this.wrap(() => this.service.createTrader(userId, body));
  }

  /** 启动 trader。 */
  @UseGuards(MembershipGateGuard)
  @Post('traders/:traderId/start')
  async startTrader(
    @CurrentUser('id') userId: string,
    @Param('traderId') traderId: string,
  ) {
    return this.wrap(() => this.service.startTrader(userId, traderId));
  }

  /** 停止 trader（允许非 Pro 用户停止，但不能启动新的）。 */
  @Post('traders/:traderId/stop')
  async stopTrader(
    @CurrentUser('id') userId: string,
    @Param('traderId') traderId: string,
  ) {
    return this.wrap(() => this.service.stopTrader(userId, traderId));
  }

  /** 删除 trader。 */
  @UseGuards(MembershipGateGuard)
  @Delete('traders/:traderId')
  async deleteTrader(
    @CurrentUser('id') userId: string,
    @Param('traderId') traderId: string,
  ) {
    return this.wrap(() => this.service.deleteTrader(userId, traderId));
  }

  /** 手动平仓。 */
  @Post('traders/:traderId/close-position')
  async closePosition(
    @CurrentUser('id') userId: string,
    @Param('traderId') traderId: string,
    @Body() body: { symbol: string; side: string },
  ) {
    return this.wrap(() => this.service.closePosition(userId, traderId, body));
  }

  // ==========================================================================
  // 通用错误归一化：service 错误 → HttpException → 全局过滤器统一响应
  //
  // 业务路由抛 HttpException 而非返 200+code，理由：
  // 1) 前端 React Query 直接走 error path（isError=true），无需自定义 code 解析
  // 2) HOOT 全局 HttpExceptionFilter 自动包装为 {code, message, data:null, requestId}
  // 3) 与 health 探测路由（200+code）形成清晰区分：探测可降级，业务必失败
  // ==========================================================================

  private async wrap<T>(fn: () => Promise<T>) {
    try {
      const data = await fn();
      return { code: 0, message: 'success', data };
    } catch (err: unknown) {
      if (err instanceof NofxUpstreamError) {
        // 4xx 透传（404 等），5xx 统一为 502
        if (err.status === 404) {
          throw new NotFoundException(err.message);
        }
        if (err.status >= 400 && err.status < 500) {
          throw new HttpException(err.message, err.status);
        }
        throw new BadGatewayException(`nofx upstream ${err.status}: ${err.message}`);
      }
      if (err instanceof NofxUnreachableError) {
        throw new ServiceUnavailableException('nofx engine unreachable');
      }
      const msg = (err as Error)?.message ?? 'unknown error';
      this.logger.error(`[nofx] unexpected error: ${msg}`);
      throw new BadGatewayException('nofx proxy internal error');
    }
  }
}
