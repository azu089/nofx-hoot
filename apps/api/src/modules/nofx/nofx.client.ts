import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { NOFX_CONFIG, type NofxRuntimeConfig } from './nofx.config';

/**
 * nofx HTTP 客户端：所有出向 nofx 的调用必须经此封装。
 *
 * 职责：
 * - 注入 baseUrl + internalToken
 * - 统一构造 X-Internal-Token / X-User-Id / X-Request-Id
 * - 统一超时与基础日志
 * - 上抛 axios 原始错误，由 service 层做映射（避免在客户端层吞错）
 *
 * 严禁在调用方手工拼 header / 写 fetch 直连 nofx。
 */
@Injectable()
export class NofxClient {
  private readonly logger = new Logger(NofxClient.name);

  constructor(
    private readonly http: HttpService,
    @Inject(NOFX_CONFIG) private readonly cfg: NofxRuntimeConfig,
  ) {}

  /** 是否已配置内网密钥（未配置时调用即 fail-fast，避免静默走匿名）。 */
  get isConfigured(): boolean {
    return this.cfg.internalToken.length > 0;
  }

  /** 透传 GET。userId 非空则注入 X-User-Id（走 nofx internal 路径）。 */
  async get<T = unknown>(
    path: string,
    opts: { userId?: string; params?: Record<string, unknown>; requestId?: string } = {},
  ): Promise<AxiosResponse<T>> {
    return this.request<T>('GET', path, opts);
  }

  /** 透传 POST。body 必填；userId 仅在调"用户级"路由时传。 */
  async post<T = unknown>(
    path: string,
    body: unknown,
    opts: { userId?: string; requestId?: string } = {},
  ): Promise<AxiosResponse<T>> {
    return this.request<T>('POST', path, { ...opts, body });
  }

  /** 透传 DELETE。 */
  async delete<T = unknown>(
    path: string,
    opts: { userId?: string; requestId?: string } = {},
  ): Promise<AxiosResponse<T>> {
    return this.request<T>('DELETE', path, opts);
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    opts: { userId?: string; params?: Record<string, unknown>; body?: unknown; requestId?: string },
  ): Promise<AxiosResponse<T>> {
    if (!this.isConfigured) {
      throw new Error('NOFX_INTERNAL_TOKEN not configured');
    }
    const url = `${this.cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      'X-Internal-Token': this.cfg.internalToken,
    };
    if (opts.userId) headers['X-User-Id'] = opts.userId;
    if (opts.requestId) headers['X-Request-Id'] = opts.requestId;

    const cfg: AxiosRequestConfig = {
      method,
      url,
      headers,
      params: opts.params,
      data: opts.body,
      timeout: this.cfg.timeoutMs,
      // 4xx/5xx 都走异常分支，由 service 层统一映射
      validateStatus: (s) => s >= 200 && s < 300,
    };

    const start = Date.now();
    try {
      const resp = await firstValueFrom(this.http.request<T>(cfg));
      this.logger.log(
        `[nofx] ${method} ${path} → ${resp.status} (${Date.now() - start}ms) user=${opts.userId ?? '-'}`,
      );
      return resp;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = (err as Error)?.message ?? 'unknown error';
      this.logger.warn(
        `[nofx] ${method} ${path} ✗ ${status ?? 'NET'} (${Date.now() - start}ms) user=${opts.userId ?? '-'} ${msg}`,
      );
      throw err;
    }
  }
}
