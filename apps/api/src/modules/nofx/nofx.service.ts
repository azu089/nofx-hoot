import { Injectable, Logger } from '@nestjs/common';
import { NofxClient } from './nofx.client';
import { NofxUserSyncService } from './nofx-user-sync.service';

/**
 * NofxService —— 业务编排层。
 *
 * 职责边界：
 * - 调用方（controller）只传 hoot user_id；service 内部决定 lazy ensureShadowUser、
 *   组装 X-User-Id、调 nofxClient、把 axios 错误归一化为 service 层语义错误。
 * - 不做数据 reshape：upstream JSON 原样上抛，由 controller 包装统一响应格式。
 *   reshape 推迟到 P4 前端确认字段后再做白名单 serializer（防止泄露 nofx 内部字段）。
 *
 * 安全门禁：
 * - userId 必须由 controller 从 @CurrentUser('id') 取得，service 不接受任何
 *   来自 query/header/body 的 userId。Service 没有"信任输入"的概念。
 * - traderId 是用户输入，nofx 端会按 user_id 隔离 trader 列表，所以即使 HOOT
 *   不做 trader-归属 校验，越权也被 nofx 拦下（双重保险）。
 *
 * 错误模型：
 * - upstream 4xx/5xx → 抛 NofxUpstreamError（带 status 和 message）
 * - 网络错误 → 抛 NofxUnreachableError
 * - controller 捕获后映射到统一响应 code
 */

export class NofxUpstreamError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'NofxUpstreamError';
  }
}

export class NofxUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NofxUnreachableError';
  }
}

@Injectable()
export class NofxService {
  private readonly logger = new Logger(NofxService.name);

  constructor(
    private readonly client: NofxClient,
    private readonly userSync: NofxUserSyncService,
  ) {}

  /** 列出当前用户的所有 trader（HOOT GET /api/nofx/traders）。 */
  async listTraders(userId: string): Promise<unknown> {
    return this.proxyGet(userId, '/api/my-traders');
  }

  /** 单个 trader 的运行状态。 */
  async getTraderStatus(userId: string, traderId: string): Promise<unknown> {
    return this.proxyGet(userId, '/api/status', { trader_id: traderId });
  }

  /** 单个 trader 的账户/权益快照。 */
  async getTraderAccount(userId: string, traderId: string): Promise<unknown> {
    return this.proxyGet(userId, '/api/account', { trader_id: traderId });
  }

  /** 单个 trader 当前持仓列表。 */
  async getTraderPositions(userId: string, traderId: string): Promise<unknown> {
    return this.proxyGet(userId, '/api/positions', { trader_id: traderId });
  }

  /** 单个 trader 各 symbol 最新决策（每 symbol 一条）。 */
  async getLatestDecisions(userId: string, traderId: string): Promise<unknown> {
    return this.proxyGet(userId, '/api/decisions/latest', { trader_id: traderId });
  }

  /** 单个 trader 的权益曲线历史。range 留给前端透传，service 不做语义校验。 */
  async getEquityHistory(
    userId: string,
    traderId: string,
    range?: string,
  ): Promise<unknown> {
    const params: Record<string, unknown> = { trader_id: traderId };
    if (range) params.range = range;
    return this.proxyGet(userId, '/api/equity-history', params);
  }

  /** 单个 trader 的统计数据（胜率/总盈亏/总单数等）。 */
  async getTraderStatistics(userId: string, traderId: string): Promise<unknown> {
    return this.proxyGet(userId, '/api/statistics', { trader_id: traderId });
  }

  /** 当前用户的策略列表（"AI 策略市场"中已订阅/创建的）。 */
  async listStrategies(userId: string): Promise<unknown> {
    return this.proxyGet(userId, '/api/strategies');
  }

  /** 当前用户配置的 AI 模型列表（含 enabled 状态）。 */
  async listAiModels(userId: string): Promise<unknown> {
    return this.proxyGet(userId, '/api/models');
  }

  /** 当前用户配置的交易所账户列表（API Key 已加密存储于 nofx）。 */
  async listExchanges(userId: string): Promise<unknown> {
    return this.proxyGet(userId, '/api/exchanges');
  }

  // ==========================================================================
  // 写操作（P6b-2）— 所有写方法走 proxyPost，由 controller 挂 MembershipGateGuard
  // ==========================================================================

  /** 创建新 trader。 */
  async createTrader(userId: string, body: unknown): Promise<unknown> {
    return this.proxyPost(userId, '/api/traders', body);
  }

  /** 启动 trader。 */
  async startTrader(userId: string, traderId: string): Promise<unknown> {
    return this.proxyPost(userId, `/api/traders/${traderId}/start`, {});
  }

  /** 停止 trader。 */
  async stopTrader(userId: string, traderId: string): Promise<unknown> {
    return this.proxyPost(userId, `/api/traders/${traderId}/stop`, {});
  }

  /** 删除 trader。 */
  async deleteTrader(userId: string, traderId: string): Promise<unknown> {
    return this.proxyDelete(userId, `/api/traders/${traderId}`);
  }

  /** 手动平仓。 */
  async closePosition(
    userId: string,
    traderId: string,
    body: { symbol: string; side: string },
  ): Promise<unknown> {
    return this.proxyPost(userId, `/api/traders/${traderId}/close-position`, body);
  }

  /**
   * 统一代理 GET：lazy ensureShadowUser → axios → 错误归一化。
   * 这是所有用户级 GET 的唯一出口，禁止 controller 绕过它直接调 client。
   *
   * 自愈逻辑：当 nofx 端返回 404 "user not found" 时，认为本地缓存的
   * "已同步" 标记是陈旧的（nofx DB 可能重启/重置），强制重同步并重试一次。
   * 这覆盖了 dev 环境频繁重建 nofx DB 以及生产环境意外的 DB 维护场景。
   */
  private async proxyGet(
    userId: string,
    path: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    await this.userSync.ensureShadowUser({ id: userId });

    try {
      return await this.callOnce(userId, path, params);
    } catch (err: unknown) {
      // 自愈：识别 nofx "user not found" → 强制重同步 → 重试一次
      if (this.isUserNotFound(err)) {
        this.logger.warn(
          `[nofx] upstream user_not_found → force resync user=${userId} path=${path}`,
        );
        await this.userSync.forceResync({ id: userId });
        return await this.callOnce(userId, path, params);
      }
      throw err;
    }
  }

  private async callOnce(
    userId: string,
    path: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const resp = await this.client.get<unknown>(path, { userId, params });
      return resp.data;
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: unknown }; message?: string };
      const status = e?.response?.status;
      const upstreamMsg =
        (e?.response?.data as { error?: string })?.error ?? e?.message ?? 'unknown error';

      if (typeof status === 'number') {
        if (status === 401) {
          this.logger.error(
            `[nofx] upstream 401 — internal token misconfigured? path=${path}`,
          );
          throw new NofxUpstreamError(502, 'nofx auth misconfigured');
        }
        throw new NofxUpstreamError(status, upstreamMsg);
      }
      throw new NofxUnreachableError(upstreamMsg);
    }
  }

  /** 统一代理 POST。 */
  private async proxyPost(
    userId: string,
    path: string,
    body: unknown,
  ): Promise<unknown> {
    await this.userSync.ensureShadowUser({ id: userId });
    try {
      const resp = await this.client.post<unknown>(path, body, { userId });
      return resp.data;
    } catch (err: unknown) {
      if (this.isUserNotFound(err)) {
        await this.userSync.forceResync({ id: userId });
        const resp = await this.client.post<unknown>(path, body, { userId });
        return resp.data;
      }
      return this.mapError(err, path);
    }
  }

  /** 统一代理 DELETE。 */
  private async proxyDelete(
    userId: string,
    path: string,
  ): Promise<unknown> {
    await this.userSync.ensureShadowUser({ id: userId });
    try {
      const resp = await this.client.delete<unknown>(path, { userId });
      return resp.data;
    } catch (err: unknown) {
      if (this.isUserNotFound(err)) {
        await this.userSync.forceResync({ id: userId });
        const resp = await this.client.delete<unknown>(path, { userId });
        return resp.data;
      }
      return this.mapError(err, path);
    }
  }

  /** 错误归一化（从 callOnce 抽出供 proxyPost/proxyDelete 复用）。总是 throw。 */
  private mapError(err: unknown, path: string): never {
    const e = err as { response?: { status?: number; data?: unknown }; message?: string };
    const status = e?.response?.status;
    const upstreamMsg =
      (e?.response?.data as { error?: string })?.error ?? e?.message ?? 'unknown error';

    if (typeof status === 'number') {
      if (status === 401) {
        this.logger.error(
          `[nofx] upstream 401 — internal token misconfigured? path=${path}`,
        );
        throw new NofxUpstreamError(502, 'nofx auth misconfigured');
      }
      throw new NofxUpstreamError(status, upstreamMsg);
    }
    throw new NofxUnreachableError(upstreamMsg);
  }

  private isUserNotFound(err: unknown): boolean {
    return (
      err instanceof NofxUpstreamError &&
      err.status === 404 &&
      /user not found/i.test(err.message)
    );
  }
}
